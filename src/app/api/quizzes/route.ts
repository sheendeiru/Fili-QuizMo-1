import { createClient } from "@/lib/supabase/server";
import {
  createAccountRoleLookup,
  resolveAccountAccess,
} from "@/lib/auth/roles";
import { isInvalidSession } from "@/lib/auth/session-errors";

type RequestBody = Record<string, unknown>;

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

// Same checks as app/api/accounts/route.ts: an active admin (with a verified
// multi-factor session) or an active teacher.
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
    return errorResponse(401, "UNAUTHENTICATED", "Sign in to manage quizzes.");
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
        "Only active admins and teachers can manage quizzes.",
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
          "Quiz management requires a verified multi-factor session.",
        );
      }
    }

    return { supabase, userId: user.id, role: access.role };
  } catch (error) {
    console.error("Quiz management role check failed.", error);
    return errorResponse(
      503,
      "MEMBERSHIP_CHECK_FAILED",
      "Unable to verify your account access.",
    );
  }
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

  if (body.action !== "delete") {
    return errorResponse(400, "INVALID_ACTION", "Choose a valid delete action.");
  }

  const quizId = typeof body.quizId === "string" ? body.quizId.trim() : "";
  if (!quizId || quizId.length > 100) {
    return errorResponse(400, "INVALID_QUIZ", "Choose a valid quiz.");
  }

  // The delete_quiz() database function checks who is asking (admin with a
  // verified MFA session, or the approved teacher who owns the quiz) and removes
  // the quiz together with its questions, attempts and results.
  // delete_quiz is not in the generated database types yet. This typed wrapper
  // keeps it compiling; once you regenerate the types it can be a plain
  // actor.supabase.rpc("delete_quiz", { p_session_id: quizId }) call.
  const { error } = await (
    actor.supabase as unknown as {
      rpc(
        fn: "delete_quiz",
        args: { p_session_id: string },
      ): PromiseLike<{ error: { code?: string; message: string } | null }>;
    }
  ).rpc("delete_quiz", { p_session_id: quizId });

  if (error) {
    switch (error.code) {
      case "28000":
        return errorResponse(401, "UNAUTHENTICATED", "Sign in to manage quizzes.");
      case "42501":
        return errorResponse(
          403,
          "DELETE_NOT_ALLOWED",
          "You are not allowed to delete this quiz.",
        );
      case "P0002":
        return errorResponse(404, "QUIZ_NOT_FOUND", "Quiz not found.");
      case "23503":
        return errorResponse(
          409,
          "QUIZ_IN_USE",
          "This quiz still has related records and cannot be deleted yet.",
        );
       case "P0001":
          return errorResponse(
            409,
            "QUIZ_LOCKED",
            error.message || "This quiz is locked and cannot be deleted.",
          );
      default:
            console.error("Quiz delete failed.", {
            quizId, code: error.code, message: error.message,
      });
    }
  }
  return Response.json(
    { deleted: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
