import { createClient } from "@/lib/supabase/server";
import { SearchError, isSearchError } from "@/lib/search/errors";
import { resolveSearchContext } from "@/lib/search/auth";
import type { SearchAuthClient } from "@/lib/search/auth";
import {
  createAccountRoleLookup,
  resolveAccountAccess,
} from "@/lib/auth/roles";
import { loadStudentQuizAttempts } from "@/lib/dashboard/data";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorResponse(error: SearchError): Response {
  return Response.json(
    { error: { code: error.code, message: error.message } },
    {
      status: error.status,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

/**
 * GET /api/student-quizzes?studentId=<uuid>
 *
 * The finished quiz attempts of one student, newest first. It reads the same
 * rows as the teacher's Assessment list (the student_quiz_results view, matched
 * by username, see loadStudentQuizAttempts in lib/dashboard/data.ts), so the
 * popup and the Assessment page always agree. A teacher gets only attempts on
 * quizzes they own; an admin with a verified multi-factor session gets quizzes
 * owned by existing teachers. Correct answers are never returned here.
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

    // quiz_sessions.teacher_id is the teacher's auth user id.
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const ownerId = user?.id ?? "";

    if (context.role !== "admin" && !ownerId) {
      throw new SearchError(
        401,
        "UNAUTHENTICATED",
        "Sign in to view student quizzes.",
      );
    }

    const { attempts, truncated } = await loadStudentQuizAttempts(
      supabase,
      profile.username ?? "",
      context.role === "admin"
        ? { kind: "admin" }
        : { kind: "teacher", ownerId },
    );

    return Response.json(
      {
        student: { id: profile.user_id, username: profile.username ?? "" },
        scope: context.role === "admin" ? "all-quizzes" : "own-quizzes",
        truncated,
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
