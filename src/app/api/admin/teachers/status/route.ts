import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createAccountRoleLookup,
  resolveAccountAccess,
} from "@/lib/auth/roles";
import { isInvalidSession } from "@/lib/auth/session-errors";
import { parseTeacherStatusUpdate } from "@/lib/auth/teacher-status";

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

export async function PATCH(request: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError && !isInvalidSession(userError)) {
    return errorResponse(
      503,
      "AUTH_CHECK_FAILED",
      "Unable to verify your sign-in session.",
    );
  }

  if (!user) {
    return errorResponse(
      401,
      "UNAUTHENTICATED",
      "Sign in to manage teacher accounts.",
    );
  }

  let access;

  try {
    access = await resolveAccountAccess(
      createAccountRoleLookup(supabase),
      user,
    );
  } catch (error) {
    console.error("Teacher status role lookup failed.", error);
    return errorResponse(
      503,
      "MEMBERSHIP_CHECK_FAILED",
      "Unable to verify your account access.",
    );
  }

  if (access.role !== "admin" || access.state !== "active") {
    return errorResponse(
      403,
      "FORBIDDEN_ROLE",
      "Only active administrators can update teacher accounts.",
    );
  }

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
      "Teacher account changes require a verified multi-factor session.",
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(
      400,
      "INVALID_REQUEST",
      "Send a JSON body with teacherId and status.",
    );
  }

  const input = parseTeacherStatusUpdate(body);

  if (!input) {
    return errorResponse(
      400,
      "INVALID_STATUS_UPDATE",
      "Choose a valid teacher and an approved, rejected, or suspended status.",
    );
  }

  const { data, error } = await supabase
    .from("teachers")
    .update({ status: input.status })
    .eq("id", input.teacherId)
    .select("id, status")
    .maybeSingle();

  if (error) {
    console.error("Teacher status update failed.", error);
    return errorResponse(
      500,
      "TEACHER_UPDATE_FAILED",
      "Unable to update the teacher account.",
    );
  }

  if (!data) {
    return errorResponse(
      404,
      "TEACHER_NOT_FOUND",
      "The teacher account could not be found.",
    );
  }

  revalidatePath("/admin-dashboard");

  return Response.json(
    {
      teacher: {
        id: String(data.id),
        status: data.status,
      },
    },
    {
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
