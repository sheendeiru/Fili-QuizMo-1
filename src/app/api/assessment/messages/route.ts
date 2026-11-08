import { createClient } from "@/lib/supabase/server";
import { isInvalidSession } from "@/lib/auth/session-errors";
import { parseUnreadSummary } from "@/lib/dashboard/unread-messages";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

type RpcResult = PromiseLike<{
  data: unknown;
  error: { code?: string; message: string } | null;
}>;

// These functions are not in the generated database types yet. This typed
// wrapper keeps them compiling; after you regenerate the types they can be
// plain supabase.rpc(...) calls.
type MessageRpc = {
  rpc(fn: "unread_message_summary", args?: Record<string, never>): RpcResult;
  rpc(fn: "mark_attempt_messages_read", args: { p_attempt_id: string }): RpcResult;
};

function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status, headers: NO_STORE });
}

async function signedInClient(): Promise<
  { client: MessageRpc } | { response: Response }
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

  return { client: supabase as unknown as MessageRpc };
}

function failed(error: { code?: string; message: string }): Response {
  if (error.code === "28000") {
    return errorResponse(401, "UNAUTHENTICATED", "Sign in to continue.");
  }

  console.error("Message notification request failed.", error.message);
  return errorResponse(
    503,
    "MESSAGES_FAILED",
    "Unable to check your messages right now.",
  );
}

/**
 * GET /api/assessment/messages
 * New messages for the signed-in student or teacher:
 * { unread: { total, items: [{ attemptId, quizTitle, student, unread, latestAt }] } }
 */
export async function GET(): Promise<Response> {
  const session = await signedInClient();
  if ("response" in session) return session.response;

  const { data, error } = await session.client.rpc("unread_message_summary");
  if (error) return failed(error);

  return Response.json({ unread: parseUnreadSummary(data) }, { headers: NO_STORE });
}

/**
 * POST /api/assessment/messages   { attemptId }
 * Marks the messages on one attempt as read. Does nothing for anyone who is
 * not that student or the teacher who owns the quiz.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_BODY", "Send the request as JSON.");
  }

  const attemptId = (body as { attemptId?: unknown } | null)?.attemptId;

  if (typeof attemptId !== "string" || !UUID_PATTERN.test(attemptId)) {
    return errorResponse(400, "INVALID_ATTEMPT", "Choose a valid quiz attempt.");
  }

  const session = await signedInClient();
  if ("response" in session) return session.response;

  const { error } = await session.client.rpc("mark_attempt_messages_read", {
    p_attempt_id: attemptId,
  });
  if (error) return failed(error);

  return Response.json({ ok: true }, { headers: NO_STORE });
}
