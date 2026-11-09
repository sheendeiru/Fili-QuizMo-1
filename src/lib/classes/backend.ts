import { createClient } from "@/lib/supabase/server";
import {
  createAccountRoleLookup,
  resolveAccountAccess,
} from "@/lib/auth/roles";
import { isInvalidSession } from "@/lib/auth/session-errors";

/**
 * Server-side bridge from the website to the quiz backend's class endpoints
 * (`/teacher/classes`, `/teacher/students`). The class tables are service-role
 * only, so the browser never talks to them: the route handlers under
 * `app/api/classes` call `proxyTeacherRequest`, which checks that the signed-in
 * user is an active teacher and forwards their own access token to the backend.
 * The backend repeats the teacher check and the ownership checks.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BACKEND_TIMEOUT_MS = 15_000;

type ProxyOptions = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  /** Backend path, for example `/teacher/classes`. */
  path: string;
  body?: unknown;
};

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
): Response {
  return Response.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

export function backendBaseUrl(): string | null {
  const value = process.env.QUIZMO_API_URL?.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin + url.pathname.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/** The backend answers errors as `{ "error": "text" }`. */
function backendMessage(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("error" in body)) {
    return null;
  }

  const error = (body as { error: unknown }).error;
  if (typeof error === "string" && error.trim()) return error;

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return null;
}

function codeForStatus(status: number): string {
  switch (status) {
    case 401:
      return "UNAUTHENTICATED";
    case 403:
      return "FORBIDDEN_ROLE";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 422:
      return "INVALID_REQUEST";
    default:
      return status >= 500 ? "BACKEND_UNAVAILABLE" : "REQUEST_FAILED";
  }
}

async function verifyTeacher(): Promise<{ accessToken: string } | Response> {
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
    return errorResponse(401, "UNAUTHENTICATED", "Sign in to manage classes.");
  }

  try {
    const access = await resolveAccountAccess(
      createAccountRoleLookup(supabase),
      user,
    );

    if (access.state !== "active" || access.role !== "teacher") {
      return errorResponse(
        403,
        "FORBIDDEN_ROLE",
        "Only active teachers can manage classes.",
      );
    }
  } catch (accessError) {
    console.error("Class management role check failed.", accessError);
    return errorResponse(
      503,
      "MEMBERSHIP_CHECK_FAILED",
      "Unable to verify your account access.",
    );
  }

  // The user is verified above; the session is read only for the token that
  // the backend validates again on its side.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return errorResponse(401, "UNAUTHENTICATED", "Sign in to manage classes.");
  }

  return { accessToken: session.access_token };
}

/**
 * Checks the caller is an active teacher, forwards the request to the quiz
 * backend and returns its JSON answer. Failures come back in the same
 * `{ error: { code, message } }` shape the other dashboard routes use.
 */
export async function proxyTeacherRequest(
  options: ProxyOptions,
): Promise<Response> {
  const teacher = await verifyTeacher();
  if (teacher instanceof Response) return teacher;

  const baseUrl = backendBaseUrl();
  if (!baseUrl) {
    console.error("QUIZMO_API_URL is missing or not a valid http(s) URL.");
    return errorResponse(
      503,
      "BACKEND_NOT_CONFIGURED",
      "Classes are not available yet. Ask the administrator to set up the quiz server connection.",
    );
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${options.path}`, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${teacher.accessToken}`,
        Accept: "application/json",
        ...(options.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
    });
  } catch (fetchError) {
    console.error(
      "Class backend request failed.",
      fetchError instanceof Error ? fetchError.name : "unknown",
    );
    return errorResponse(
      503,
      "BACKEND_UNAVAILABLE",
      "Could not reach the quiz server. Please retry.",
    );
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const status = response.status;
    return errorResponse(
      status,
      codeForStatus(status),
      backendMessage(payload) ??
        (status >= 500
          ? "The quiz server could not complete the request. Please retry."
          : "The request could not be completed."),
    );
  }

  return Response.json(payload ?? {}, {
    status: response.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function readJsonBody(
  request: Request,
): Promise<Record<string, unknown> | Response> {
  let value: unknown;

  try {
    value = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Send a valid JSON request.");
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return errorResponse(400, "INVALID_BODY", "Send a JSON object.");
  }

  return value as Record<string, unknown>;
}
