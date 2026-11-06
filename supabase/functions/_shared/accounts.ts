import {
  createClient,
  type SupabaseClient,
  type User,
} from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "./cors.ts";

// ---------------------------------------------------------------------
// Errors and responses
// ---------------------------------------------------------------------

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store", // responses may contain temporary passwords
    },
  });
}

/** Wraps a handler with CORS preflight, POST-only and error mapping. */
export function serve(handle: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") return json(405, { error: "Use POST" });

    try {
      return await handle(req);
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, { error: e.message });
      console.error("Unhandled error:", e);
      return json(500, { error: "Unexpected error" });
    }
  });
}

// ---------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------

export interface UpdateRequest {
  userId: string;
  email?: string;
  password?: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function parseUpdateRequest(req: Request): Promise<UpdateRequest> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Body must be valid JSON");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "Body must be a JSON object");
  }
  const { user_id, email, password } = body as Record<string, unknown>;

  if (typeof user_id !== "string" || !UUID_RE.test(user_id)) {
    throw new HttpError(400, "user_id must be a UUID");
  }
  const out: UpdateRequest = { userId: user_id.toLowerCase() };

  if (email !== undefined) {
    if (typeof email !== "string") throw new HttpError(400, "email must be a string");
    const normalized = email.trim().toLowerCase();
    if (normalized.length > 254 || !EMAIL_RE.test(normalized)) {
      throw new HttpError(400, "email is not valid");
    }
    out.email = normalized;
  }

  if (password !== undefined) {
    if (typeof password !== "string") {
      throw new HttpError(400, "password must be a string");
    }
    // bcrypt only uses the first 72 bytes, so reject longer passwords.
    if (password.length < 8 || new TextEncoder().encode(password).length > 72) {
      throw new HttpError(400, "password must be 8 to 72 bytes long");
    }
    out.password = password;
  }

  if (out.email === undefined && out.password === undefined) {
    throw new HttpError(400, "Provide email and/or password");
  }
  return out;
}

// ---------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------

export interface Context {
  caller: User;
  /** Assurance level from the validated access token ("aal1" or "aal2"). */
  assuranceLevel: string | null;
  /** Acts as the caller: RLS and auth.uid() apply. Use for authorization checks. */
  userClient: SupabaseClient;
  /** Service role: bypasses RLS. Use only AFTER authorization succeeded. */
  adminClient: SupabaseClient;
}

function assuranceLevelOf(token: string): string | null {
  const payload = token.split(".")[1];
  if (!payload) return null;

  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    const claims = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)),
      ),
    );
    return typeof claims.aal === "string" ? claims.aal : null;
  } catch {
    return null;
  }
}

export async function authenticate(req: Request): Promise<Context> {
  const token = (req.headers.get("Authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  if (!token) throw new HttpError(401, "Missing bearer token");

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) {
    console.error("Missing SUPABASE_* environment variables");
    throw new HttpError(500, "Server is not configured");
  }

  const noSession = { persistSession: false, autoRefreshToken: false };

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: noSession,
  });
  const { data, error } = await userClient.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Invalid or expired session");

  const adminClient = createClient(url, serviceKey, { auth: noSession });
  return {
    caller: data.user,
    assuranceLevel: assuranceLevelOf(token),
    userClient,
    adminClient,
  };
}

// ---------------------------------------------------------------------
// Lookups (service role)
// ---------------------------------------------------------------------

export async function rowExists(
  adminClient: SupabaseClient,
  table: "teachers" | "admins",
  userId: string,
): Promise<boolean> {
  const { data, error } = await adminClient
    .from(table)
    .select("user_id")
    .eq("user_id", userId)
    .limit(1);
  if (error) {
    console.error(`Lookup in ${table} failed:`, error.message);
    throw new HttpError(500, "Lookup failed");
  }
  return (data?.length ?? 0) > 0;
}

export async function profileRole(
  adminClient: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await adminClient
    .from("account_profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("Lookup in account_profiles failed:", error.message);
    throw new HttpError(500, "Lookup failed");
  }
  return data?.role ?? null;
}

// ---------------------------------------------------------------------
// The actual change
// ---------------------------------------------------------------------

export async function applyCredentialUpdate(
  adminClient: SupabaseClient,
  req: UpdateRequest,
): Promise<{ email: string | undefined }> {
  const attrs: { email?: string; password?: string; email_confirm?: boolean } =
    {};
  if (req.email !== undefined) {
    attrs.email = req.email;
    // The admin/teacher vouches for the address, so skip the confirmation
    // mail. Otherwise the user could be locked out until they confirm.
    attrs.email_confirm = true;
  }
  if (req.password !== undefined) attrs.password = req.password;

  const { data, error } = await adminClient.auth.admin.updateUserById(
    req.userId,
    attrs,
  );

  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "email_exists") throw new HttpError(409, "That email is already in use");
    if (code === "weak_password") throw new HttpError(400, error.message);
    if (code === "user_not_found") throw new HttpError(404, "Account not found");
    console.error("updateUserById failed:", code, error.message);
    throw new HttpError(500, "Could not update the account");
  }
  // email changes are copied to account_profiles / teachers by the
  // on_auth_user_email_changed trigger (student_teacher_access.sql).
  return { email: data.user?.email };
}

/** Best-effort audit trail. Never logs the password itself. */
export async function logChange(
  adminClient: SupabaseClient,
  actorId: string,
  req: UpdateRequest,
): Promise<void> {
  const { error } = await adminClient.from("account_credential_changes").insert({
    actor_user_id: actorId,
    target_user_id: req.userId,
    changed_email: req.email !== undefined,
    changed_password: req.password !== undefined,
  });
  if (error) console.error("Audit log insert failed:", error.message);
}

export function updatedFields(req: UpdateRequest): string[] {
  const fields: string[] = [];
  if (req.email !== undefined) fields.push("email");
  if (req.password !== undefined) fields.push("password");
  return fields;
}
