import { createClient } from "@/lib/supabase/server";
import {
  createAccountRoleLookup,
  isValidUsername,
  resolveAccountAccess,
} from "@/lib/auth/roles";
import { isInvalidSession } from "@/lib/auth/session-errors";

type AccountRole = "student" | "teacher";
type RequestBody = Record<string, unknown>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorResponse(
  status: number,
  code: string,
  message: string,
): Response {
  return Response.json(
    { error: { code, message } },
    {
      status,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

async function readBody(request: Request): Promise<RequestBody | Response> {
  let value: unknown;

  try {
    value = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Send a valid JSON request.");
  }

  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return errorResponse(400, "INVALID_BODY", "Send a JSON object.");
  }

  return value as RequestBody;
}

async function verifyActor(): Promise<
  | {
      supabase: Awaited<ReturnType<typeof createClient>>;
      userId: string;
      role: "admin" | "teacher";
    }
  | Response
> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error && !isInvalidSession(error)) {
    return errorResponse(
      503,
      "AUTH_CHECK_FAILED",
      "Unable to verify your sign-in session.",
    );
  }

  if (!user) {
    return errorResponse(401, "UNAUTHENTICATED", "Sign in to manage accounts.");
  }

  try {
    const access = await resolveAccountAccess(
      createAccountRoleLookup(supabase),
      user,
    );

    if (
      access.state !== "active" ||
      (access.role !== "admin" && access.role !== "teacher")
    ) {
      return errorResponse(
        403,
        "FORBIDDEN_ROLE",
        "Only active admins and teachers can manage accounts.",
      );
    }

    if (access.role === "admin") {
      const { data: assurance, error: assuranceError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (assuranceError) {
        return errorResponse(
          503,
          "SECURITY_LEVEL_UNAVAILABLE",
          "Unable to verify your session security level.",
        );
      }

      if (assurance.currentLevel !== "aal2") {
        return errorResponse(
          403,
          "MFA_REQUIRED",
          "Account management requires a verified multi-factor session.",
        );
      }
    }

    return { supabase, userId: user.id, role: access.role };
  } catch (error) {
    console.error("Account management role check failed.", error);
    return errorResponse(
      503,
      "MEMBERSHIP_CHECK_FAILED",
      "Unable to verify your account access.",
    );
  }
}

function validRole(value: unknown): value is AccountRole {
  return value === "student" || value === "teacher";
}

function parseCreateInput(body: RequestBody):
  | {
      accountRole: AccountRole;
      username: string;
      email: string;
      password?: string;
      teacherId?: number;
    }
  | Response {
  if (!validRole(body.accountRole)) {
    return errorResponse(400, "INVALID_ROLE", "Choose a valid account role.");
  }

  const username =
    typeof body.username === "string" ? body.username.trim() : "";
  if (!isValidUsername(username)) {
    return errorResponse(
      400,
      "INVALID_USERNAME",
      "Username must be 3 to 15 characters, start with a letter, and use only letters, numbers, or underscores.",
    );
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return errorResponse(400, "INVALID_EMAIL", "Enter a valid email address.");
  }

  let password: string | undefined;
  if (body.password !== undefined && body.password !== "") {
    if (
      typeof body.password !== "string" ||
      body.password.length < 8 ||
      new TextEncoder().encode(body.password).length > 72
    ) {
      return errorResponse(
        400,
        "INVALID_PASSWORD",
        "Temporary passwords must be 8 to 72 bytes long.",
      );
    }
    password = body.password;
  }

  let teacherId: number | undefined;
  if (body.teacherId !== undefined && body.teacherId !== "") {
    teacherId = Number(body.teacherId);
    if (!Number.isSafeInteger(teacherId) || teacherId < 1) {
      return errorResponse(
        400,
        "INVALID_TEACHER",
        "Choose a valid managing teacher.",
      );
    }
  }

  return {
    accountRole: body.accountRole,
    username,
    email,
    ...(password ? { password } : {}),
    ...(teacherId ? { teacherId } : {}),
  };
}

async function invokeAccountFunction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: "manage-teachers" | "manage-students",
  body: RequestBody,
): Promise<Response> {
  try {
    const { data, error } = await supabase.functions.invoke(name, { body });

    if (error) {
      const context = error.context;
      if (context instanceof Response) {
        let detail: unknown = null;
        try {
          detail = await context.json();
        } catch {
          detail = null;
        }

        const message =
          typeof detail === "object" &&
          detail !== null &&
          "error" in detail &&
          typeof detail.error === "string"
            ? detail.error
            : "The account service could not complete the request.";
        return errorResponse(
          context.status >= 400 && context.status < 600
            ? context.status
            : 502,
          "ACCOUNT_ACTION_FAILED",
          message,
        );
      }

      console.error("Account edge function invocation failed.", error.message);
      return errorResponse(
        502,
        "ACCOUNT_SERVICE_UNAVAILABLE",
        "The account service is temporarily unavailable.",
      );
    }

    return Response.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Account edge function request failed.", error);
    return errorResponse(
      502,
      "ACCOUNT_SERVICE_UNAVAILABLE",
      "The account service is temporarily unavailable.",
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  const actor = await verifyActor();
  if (actor instanceof Response) {
    return actor;
  }

  const body = await readBody(request);
  if (body instanceof Response) {
    return body;
  }

  if (body.action !== "create") {
    return errorResponse(400, "INVALID_ACTION", "Choose a valid account action.");
  }

  const input = parseCreateInput(body);
  if (input instanceof Response) {
    return input;
  }

  if (actor.role === "teacher" && input.accountRole !== "student") {
    return errorResponse(
      403,
      "FORBIDDEN_ROLE",
      "Teachers can create student accounts only.",
    );
  }

  if (input.accountRole === "student") {
    return invokeAccountFunction(actor.supabase, "manage-students", {
      action: "create",
      username: input.username,
      email: input.email,
      ...(input.password ? { password: input.password } : {}),
      ...(input.teacherId ? { teacher_id: input.teacherId } : {}),
    });
  }

  return invokeAccountFunction(actor.supabase, "manage-teachers", {
    action: "create",
    username: input.username,
    email: input.email,
    ...(input.password ? { password: input.password } : {}),
    status: "approved",
  });
}

export async function DELETE(request: Request): Promise<Response> {
  const actor = await verifyActor();
  if (actor instanceof Response) {
    return actor;
  }

  const body = await readBody(request);
  if (body instanceof Response) {
    return body;
  }

  if (body.action !== "delete" || !validRole(body.accountRole)) {
    return errorResponse(
      400,
      "INVALID_ACTION",
      "Choose a valid account role and delete action.",
    );
  }

  if (actor.role === "teacher" && body.accountRole !== "student") {
    return errorResponse(
      403,
      "FORBIDDEN_ROLE",
      "Teachers can delete student accounts only.",
    );
  }

  let userId: string;
  if (body.accountRole === "teacher") {
    const teacherId = Number(body.accountId);
    if (!Number.isSafeInteger(teacherId) || teacherId < 1) {
      return errorResponse(400, "INVALID_ACCOUNT", "Choose a valid teacher.");
    }

    const { data: teacher, error } = await actor.supabase
      .from("teachers")
      .select("user_id")
      .eq("id", teacherId)
      .maybeSingle();

    if (error) {
      console.error("Teacher account lookup failed.", error.message);
      return errorResponse(
        503,
        "ACCOUNT_LOOKUP_FAILED",
        "Unable to look up the teacher account.",
      );
    }

    if (!teacher) {
      return errorResponse(404, "ACCOUNT_NOT_FOUND", "Teacher account not found.");
    }

    userId = teacher.user_id;
  } else {
    if (
      typeof body.accountId !== "string" ||
      !UUID_PATTERN.test(body.accountId)
    ) {
      return errorResponse(400, "INVALID_ACCOUNT", "Choose a valid student.");
    }
    userId = body.accountId.toLowerCase();
  }

  if (userId === actor.userId) {
    return errorResponse(403, "SELF_DELETE_BLOCKED", "You cannot delete your own account.");
  }

  return invokeAccountFunction(
    actor.supabase,
    body.accountRole === "teacher" ? "manage-teachers" : "manage-students",
    {
      action: "delete",
      user_id: userId,
    },
  );
}
