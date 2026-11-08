import { createClient } from "@/lib/supabase/server";
import { isInvalidSession } from "@/lib/auth/session-errors";
import {
  FEEDBACK_MAX_LENGTH,
  parseFeedbackCounts,
  parseFeedbackItem,
} from "@/lib/dashboard/assessment";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

type RpcResult = PromiseLike<{
  data: unknown;
  error: { code?: string; message: string } | null;
}>;

// The feedback functions are not in the generated database types yet. This
// typed wrapper keeps them compiling; after you regenerate the types these can
// be plain supabase.rpc(...) calls.
type FeedbackRpc = {
  rpc(fn: "attempt_feedback_counts", args?: Record<string, never>): RpcResult;
  rpc(
    fn: "add_attempt_feedback",
    args: { p_attempt_id: string; p_message: string },
  ): RpcResult;
  rpc(fn: "delete_attempt_feedback", args: { p_feedback_id: string }): RpcResult;
};

function errorResponse(
  status: number,
  code: string,
  message: string,
): Response {
  return Response.json({ error: { code, message } }, { status, headers: NO_STORE });
}

async function signedInClient(): Promise<
  { client: FeedbackRpc } | { response: Response }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError && !isInvalidSession(authError)) {
    return {
      response: errorResponse(
        503,
        "AUTH_CHECK_FAILED",
        "Unable to verify your sign-in session.",
      ),
    };
  }

  if (!user) {
    return {
      response: errorResponse(401, "UNAUTHENTICATED", "Sign in to continue."),
    };
  }

  return { client: supabase as unknown as FeedbackRpc };
}

function mapDatabaseError(error: { code?: string; message: string }): Response {
  switch (error.code) {
    case "28000":
      return errorResponse(401, "UNAUTHENTICATED", "Sign in to continue.");
    case "P0002":
      return errorResponse(
        404,
        "NOT_FOUND",
        "We could not find that quiz attempt or message.",
      );
    case "22023":
      return errorResponse(
        400,
        "INVALID_FEEDBACK",
        `Write a message between 1 and ${FEEDBACK_MAX_LENGTH} characters.`,
      );
    case "54000":
      return errorResponse(
        409,
        "TOO_MANY_MESSAGES",
        "This quiz already has the maximum number of messages.",
      );
    default:
      console.error("Feedback request failed.", error.message);
      return errorResponse(
        503,
        "FEEDBACK_FAILED",
        "Unable to save feedback right now. Please try again.",
      );
  }
}

/**
 * GET /api/assessment/feedback
 * Messages per attempt: { counts: { attemptId: { count, lastRole } } }.
 * For a student: their own attempts. For a teacher: attempts on their quizzes.
 */
export async function GET(): Promise<Response> {
  const session = await signedInClient();
  if ("response" in session) return session.response;

  const { data, error } = await session.client.rpc("attempt_feedback_counts");
  if (error) return mapDatabaseError(error);

  return Response.json({ counts: parseFeedbackCounts(data) }, { headers: NO_STORE });
}

/**
 * POST /api/assessment/feedback   { attemptId, message }
 * A student can write on their own attempt (a reply or a question); the
 * approved teacher who owns the quiz can write on any attempt of theirs. The
 * database function decides which, and enforces the limits.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_BODY", "Send the message as JSON.");
  }

  const { attemptId, message } = (body ?? {}) as {
    attemptId?: unknown;
    message?: unknown;
  };

  if (typeof attemptId !== "string" || !UUID_PATTERN.test(attemptId)) {
    return errorResponse(400, "INVALID_ATTEMPT", "Choose a valid quiz attempt.");
  }

  const text = typeof message === "string" ? message.trim() : "";
  if (text.length < 1 || text.length > FEEDBACK_MAX_LENGTH) {
    return errorResponse(
      400,
      "INVALID_FEEDBACK",
      `Write a message between 1 and ${FEEDBACK_MAX_LENGTH} characters.`,
    );
  }

  const session = await signedInClient();
  if ("response" in session) return session.response;

  const { data, error } = await session.client.rpc("add_attempt_feedback", {
    p_attempt_id: attemptId,
    p_message: text,
  });
  if (error) return mapDatabaseError(error);

  const feedback = parseFeedbackItem(data);
  if (!feedback) {
    console.error("Feedback payload was not in the expected shape.");
    return errorResponse(
      503,
      "FEEDBACK_FAILED",
      "Unable to save feedback right now. Please try again.",
    );
  }

  return Response.json({ feedback }, { status: 201, headers: NO_STORE });
}

/**
 * DELETE /api/assessment/feedback?feedbackId=<uuid>
 * Anyone can remove a message they wrote themselves.
 */
export async function DELETE(request: Request): Promise<Response> {
  const feedbackId = new URL(request.url).searchParams.get("feedbackId") ?? "";

  if (!UUID_PATTERN.test(feedbackId)) {
    return errorResponse(400, "INVALID_FEEDBACK", "Choose a valid message.");
  }

  const session = await signedInClient();
  if ("response" in session) return session.response;

  const { error } = await session.client.rpc("delete_attempt_feedback", {
    p_feedback_id: feedbackId,
  });
  if (error) return mapDatabaseError(error);

  return Response.json({ deleted: true }, { headers: NO_STORE });
}
