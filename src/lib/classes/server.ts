import { backendBaseUrl } from "@/lib/classes/backend";
import {
  parseAssignedQuizzes,
  parseAssignments,
  parseClasses,
  type AssignedQuiz,
  type QuizAssignment,
  type TeacherClass,
} from "@/lib/classes/client";
import { createClient } from "@/lib/supabase/server";

// These reads only add to pages that already work, so a slow backend must not
// hold those pages up for long.
const BACKEND_TIMEOUT_MS = 4_000;

/**
 * GETs one backend path with the signed-in user's own token, for server code
 * that has already checked the user's role (the backend checks it again).
 * Returns the parsed JSON, or `null` when the backend is not configured,
 * unreachable, or refuses (for example class publishing is not set up yet).
 */
async function getFromBackend(path: string): Promise<unknown | null> {
  const baseUrl = backendBaseUrl();
  if (!baseUrl) return null;

  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) return null;

    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
    });

    return response.ok ? await response.json() : null;
  } catch (error) {
    console.error(
      "Quiz backend request failed.",
      path,
      error instanceof Error ? error.name : "unknown",
    );
    return null;
  }
}

/** The signed-in teacher's classes, or `null` when unavailable. */
export async function loadTeacherClasses(): Promise<TeacherClass[] | null> {
  const payload = await getFromBackend("/teacher/classes");
  return payload === null ? null : parseClasses(payload);
}

/** Where the signed-in teacher's quizzes were sent, or `null` when unavailable. */
export async function loadTeacherAssignments(): Promise<
  QuizAssignment[] | null
> {
  const payload = await getFromBackend("/teacher/assignments");
  return payload === null ? null : parseAssignments(payload);
}

/** Quizzes sent to the signed-in student, or `null` when unavailable. */
export async function loadStudentAssignedQuizzes(): Promise<
  AssignedQuiz[] | null
> {
  const payload = await getFromBackend("/student/quizzes");
  return payload === null ? null : parseAssignedQuizzes(payload);
}
