import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { HttpError, type Context } from "./accounts.ts";

// ---------------------------------------------------------------------
// Request parsing
// ---------------------------------------------------------------------

export type Body = Record<string, unknown>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function readBody(req: Request): Promise<Body> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Body must be valid JSON");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "Body must be a JSON object");
  }
  return body as Body;
}

export function requireUuid(body: Body, field: string): string {
  const v = body[field];
  if (typeof v !== "string" || !UUID_RE.test(v)) {
    throw new HttpError(400, `${field} must be a UUID`);
  }
  return v.toLowerCase();
}

export function requireEmail(body: Body): string {
  const v = body.email;
  if (typeof v !== "string") throw new HttpError(400, "email is required");
  const email = v.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    throw new HttpError(400, "email is not valid");
  }
  return email;
}

export function requireUsername(body: Body): string {
  const v = body.username;
  if (typeof v !== "string") throw new HttpError(400, "username is required");
  const username = v.trim();
  // deno-lint-ignore no-control-regex
  if (username.length < 3 || username.length > 50 || /[\u0000-\u001f\u007f]/.test(username)) {
    throw new HttpError(400, "username must be 3 to 50 characters");
  }
  return username;
}

/** Returns null when no password was supplied (caller generates one). */
export function optionalPassword(body: Body): string | null {
  const v = body.password;
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") throw new HttpError(400, "password must be a string");
  // bcrypt only uses the first 72 bytes
  if (v.length < 8 || new TextEncoder().encode(v).length > 72) {
    throw new HttpError(400, "password must be 8 to 72 bytes long");
  }
  return v;
}

// ---------------------------------------------------------------------
// Temporary password generator (cryptographically secure)
// ---------------------------------------------------------------------

const LOWER = "abcdefghijkmnopqrstuvwxyz"; // no l
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I, O
const DIGIT = "23456789"; // no 0, 1
const SYMBOL = "!@#$%&*?";

/** Uniform random integer in [0, max) without modulo bias. */
function randInt(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
}

const pick = (set: string) => set[randInt(set.length)];

export function generatePassword(length = 14): string {
  const all = LOWER + UPPER + DIGIT + SYMBOL;
  // one of each class so strict project password rules are satisfied
  const chars = [pick(LOWER), pick(UPPER), pick(DIGIT), pick(SYMBOL)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

// ---------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------

/** Checked by the database as the caller (is_admin() reads auth.uid()). */
export async function requireAdmin(ctx: Context): Promise<void> {
  const { data, error } = await ctx.userClient.rpc("is_admin");
  if (error) {
    console.error("is_admin failed:", error.message);
    throw new HttpError(500, "Authorization check failed");
  }
  if (data !== true) throw new HttpError(403, "Admins only");

  // The edge runtime has no persisted auth session, so read the assurance
  // level from the JWT that authenticate() already verified.
  if (ctx.assuranceLevel !== "aal2") {
    throw new HttpError(403, "Admin account management requires MFA");
  }
}

// ---------------------------------------------------------------------
// Auth Admin API wrappers
// ---------------------------------------------------------------------

function failAuth(err: unknown, context: string): never {
  const e = err as { code?: string; message: string };
  switch (e.code) {
    case "email_exists":
    case "user_already_exists":
      throw new HttpError(409, "That email is already in use");
    case "weak_password":
      throw new HttpError(400, e.message);
    case "user_not_found":
      throw new HttpError(404, "Account not found");
  }
  console.error(`${context} failed:`, e.code, e.message);
  throw new HttpError(500, "Could not complete the request");
}

export async function createAuthUser(
  adminClient: SupabaseClient,
  email: string,
  password: string,
): Promise<string> {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // the teacher/admin vouches for the address
  });
  if (error || !data.user) failAuth(error, "createUser");
  return data.user.id;
}

export async function deleteAuthUser(
  adminClient: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) failAuth(error, "deleteUser");
}

/** Used to roll back a half-created account; never throws. */
export async function deleteAuthUserQuietly(
  adminClient: SupabaseClient,
  userId: string,
): Promise<void> {
  try {
    await deleteAuthUser(adminClient, userId);
  } catch (e) {
    console.error("Rollback of auth user failed:", userId, e);
  }
}

export async function emailOf(
  adminClient: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await adminClient.auth.admin.getUserById(userId);
  if (error) failAuth(error, "getUserById");
  return data.user?.email ?? null;
}

/** Sets a fresh random password and returns it (shown to the caller once). */
export async function resetPassword(
  adminClient: SupabaseClient,
  userId: string,
): Promise<string> {
  const temporary = generatePassword();
  const { error } = await adminClient.auth.admin.updateUserById(userId, {
    password: temporary,
  });
  if (error) failAuth(error, "updateUserById");
  return temporary;
}

// ---------------------------------------------------------------------
// Database helpers (service role)
// ---------------------------------------------------------------------

/** Usernames share one namespace across students and teachers (case-insensitive). */
export async function usernameTaken(
  adminClient: SupabaseClient,
  username: string,
): Promise<boolean> {
  const inProfiles = await adminClient
    .from("account_profiles")
    .select("user_id")
    .eq("username_key", username.toLowerCase())
    .limit(1);
  const inTeachers = await adminClient
    .from("teachers")
    .select("id")
    .ilike("username", username.replace(/[%_\\]/g, "\\$&"))
    .limit(1);
  if (inProfiles.error || inTeachers.error) {
    console.error("username lookup failed:", inProfiles.error?.message, inTeachers.error?.message);
    throw new HttpError(500, "Lookup failed");
  }
  return (inProfiles.data?.length ?? 0) > 0 || (inTeachers.data?.length ?? 0) > 0;
}

export async function countRows(
  adminClient: SupabaseClient,
  table: "quizzes" | "account_profiles",
  column: "teacher_id" | "managed_by_teacher_id",
  teacherRowId: number,
): Promise<number> {
  const { count, error } = await adminClient
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, teacherRowId);
  if (error) {
    console.error(`count on ${table} failed:`, error.message);
    throw new HttpError(500, "Lookup failed");
  }
  return count ?? 0;
}

// ---------------------------------------------------------------------
// Audit log (best effort; never contains passwords)
// ---------------------------------------------------------------------

export type AuditAction = "create" | "delete" | "reset_password";

export async function logAction(
  adminClient: SupabaseClient,
  entry: {
    actorId: string;
    targetId: string;
    targetEmail: string | null;
    action: AuditAction;
    changedEmail?: boolean;
    changedPassword?: boolean;
  },
): Promise<void> {
  const { error } = await adminClient.from("account_credential_changes").insert({
    actor_user_id: entry.actorId,
    target_user_id: entry.targetId,
    target_email: entry.targetEmail,
    action: entry.action,
    changed_email: entry.changedEmail ?? false,
    changed_password: entry.changedPassword ?? false,
  });
  if (error) console.error("Audit log insert failed:", error.message);
}
