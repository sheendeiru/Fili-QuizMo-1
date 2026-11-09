import { createClient } from "@/lib/supabase/server";
import { SearchError, isSearchError } from "@/lib/search/errors";
import { resolveSearchContext } from "@/lib/search/auth";
import type { SearchAuthClient } from "@/lib/search/auth";
import {
  createAccountRoleLookup,
  resolveAccountAccess,
} from "@/lib/auth/roles";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// More than this many finished attempts are cut off and flagged as truncated.
// (Not exported: Next.js route files may only export HTTP handlers.)
const STUDENT_QUIZZES_LIMIT = 100;

const COLUMNS =
  "attempt_id, session_id, quiz_title, attempt_number, correct_count, total_questions, percentage, started_at, completed_at, duration_seconds";

function errorResponse(error: SearchError): Response {
  return Response.json(
    { error: { code: error.code, message: error.message } },
    {
      status: error.status,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

function numberOrNull(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * GET /api/student-quizzes?studentId=<uuid>
 *
 * The finished quiz attempts of one student, newest first. Who may see what is
 * decided by row-level security on the teacher_student_scores view: a teacher
 * gets only attempts on quizzes they own (for students they manage or who took
 * their quizzes), an admin with a verified multi-factor session gets all of
 * them. Correct answers are never returned here.
 */
export async function GET(request: Request): Promise<Response> {
  const studentId =
    new URL(request.url).searchParams.get("studentId")?.trim() ?? "";

  try {
    if (!UUID_PATTERN.test(studentId)) {
      throw new SearchError(400, "INVALID_STUDENT", "Choose a valid student.");
    }

    const supabase = await createClient();
    const authClient: SearchAuthClient = {
      auth: {
        getUser: () => supabase.auth.getUser(),
        mfa: {
          getAuthenticatorAssuranceLevel: () =>
            supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        },
      },
      resolveAccess: (user) =>
        resolveAccountAccess(createAccountRoleLookup(supabase), user),
    };
    const context = await resolveSearchContext(authClient);
    const id = studentId.toLowerCase();

    // Visible to teachers only for students they manage or who took their
    // quizzes (profiles_select_teacher), so this also stops probing arbitrary ids.
    const { data: profile, error: profileError } = await supabase
      .from("account_profiles")
      .select("user_id, username")
      .eq("user_id", id)
      .eq("role", "student")
      .maybeSingle();

    if (profileError) {
      console.error("Student profile lookup failed.", profileError.message);
      throw new SearchError(
        503,
        "STUDENT_LOOKUP_FAILED",
        "Unable to look up this student.",
      );
    }

    if (!profile) {
      throw new SearchError(404, "STUDENT_NOT_FOUND", "Student not found.");
    }

    const { data: rows, error } = await supabase
      .from("teacher_student_scores")
      .select(COLUMNS)
      .eq("student_user_id", id)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(STUDENT_QUIZZES_LIMIT + 1);

    if (error) {
      console.error("Student quiz history failed.", error.message);
      throw new SearchError(
        503,
        "STUDENT_QUIZZES_FAILED",
        "Unable to load this student's quizzes right now.",
      );
    }

    const attempts = (rows ?? []).slice(0, STUDENT_QUIZZES_LIMIT).map((row) => ({
      attemptId: row.attempt_id ?? "",
      sessionId: row.session_id ?? "",
      quizTitle: row.quiz_title?.trim() || "Untitled quiz",
      attemptNumber: numberOrNull(row.attempt_number),
      correctCount: numberOrNull(row.correct_count),
      totalQuestions: numberOrNull(row.total_questions),
      percentage: numberOrNull(row.percentage),
      startedAt: row.started_at,
      completedAt: row.completed_at,
      durationSeconds: numberOrNull(row.duration_seconds),
    }));

    return Response.json(
      {
        student: { id: profile.user_id, username: profile.username ?? "" },
        scope: context.role === "admin" ? "all-quizzes" : "own-quizzes",
        truncated: (rows?.length ?? 0) > STUDENT_QUIZZES_LIMIT,
        quizzes: attempts,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (isSearchError(error)) {
      return errorResponse(error);
    }

    console.error("Student quizzes request failed.", error);
    return errorResponse(
      new SearchError(
        500,
        "STUDENT_QUIZZES_FAILED",
        "Unable to load this student's quizzes right now.",
      ),
    );
  }
}
