import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { buildLeaderboards, type LeaderboardData } from "./leaderboard";
import {
  buildScoreDistribution,
  scoreStatusLabel,
  type ScoreDistribution,
} from "./score-bands";

export type DashboardQuiz = {
  id: string;
  title: string;
  status: string;
  teacherUsername: string;
  createdAt: string;
};

export type DashboardScore = {
  id: string;
  student: string;
  quizTitle: string;
  score: number;
  /** Raw score parts, e.g. 8 and 10 for "8/10". null if the view has no counts. */
  correct?: number | null;
  total?: number | null;
  status: string;
  completedAt: string;
};

export type DashboardTeacher = {
  id: string;
  username: string;
  email: string;
  status: string;
  quizCount: number;
  createdAt: string;
};

export type QuizStatusSummary = {
  total: number;
  ready: number;
  draft: number;
  failed: number;
};

export type TeacherStatusSummary = {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  suspended: number;
};

export type ResultSummary = {
  total: number;
  average: number;
};

export type AdminDashboardData = {
  quizzes: QuizStatusSummary;
  teachers: TeacherStatusSummary;
  /** Admin: number of student login accounts (matches the accounts table). */
  studentCount: number;
  results: ResultSummary;
  /** Results and recent scores of student login accounts only (accounts page). */
  studentResults: ResultSummary;
  studentRecentScores: DashboardScore[];
  recentQuizzes: DashboardQuiz[];
  recentScores: DashboardScore[];
  distributions: ScoreDistribution[];
  teacherAccounts: DashboardTeacher[];
};

export type TeacherDashboardData = {
  quizzes: QuizStatusSummary;
  /** Teacher: distinct students who joined or finished this teacher's quizzes. */
  studentCount: number;
  results: ResultSummary;
  recentQuizzes: DashboardQuiz[];
  recentScores: DashboardScore[];
  distributions: ScoreDistribution[];
  leaderboards: LeaderboardData;
};

/**
 * One row of public.quiz_sessions. This is the table the app writes new quizzes
 * to. teacher_id there is the teacher's auth user id (uuid as text), NOT
 * teachers.id.
 */
type QuizRow = {
  session_id: string;
  title: string | null;
  status: string;
  teacher_id: string | null;
  created_at: string | null;
};

type TeacherRow = {
  id: number;
  user_id: string;
  username: string | null;
  email: string | null;
  status: string;
  created_at: string;
};

type ResultRow = {
  attempt_id: string;
  session_id: string | null;
  title: string;
  participant_username: string;
  percentage: number | string;
  correct_count: number | string | null;
  total_questions: number | string | null;
  completed_at: string;
};

type RosterRow = {
  session_id: string | null;
  username: string | null;
};

const QUIZ_COLUMNS = "session_id, title, status, teacher_id, created_at";
const RESULT_COLUMNS =
  "attempt_id, session_id, title, participant_username, percentage, correct_count, total_questions, completed_at";
const QUIZ_LIMIT = 1_000;
const RESULT_LIMIT = 1_000;
const ROSTER_LIMIT = 5_000;
// PostgREST puts .in() values in the URL, so long id lists are sent in chunks.
const SESSION_CHUNK = 50;

function readNumber(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

/** A count such as correct answers, or null when it is missing or not a number. */
function readCount(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * quiz_sessions.created_at is "timestamp without time zone" (stored in UTC), so
 * the API returns it without a "Z". Browsers would read that as local time and
 * show it hours off. Mark it as UTC.
 */
function toIso(value: string | null): string {
  if (!value) {
    return "";
  }

  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)
    ? value
    : `${value.replace(" ", "T")}Z`;
}

function normalizeQuizzes(rows: readonly QuizRow[]): QuizRow[] {
  return rows.map((row) => ({ ...row, created_at: toIso(row.created_at) }));
}

function chunk<T>(items: readonly T[], size = SESSION_CHUNK): T[][] {
  const groups: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }

  return groups;
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** Distinct students from the roster plus anyone who has submitted a result. */
function countDistinctStudents(
  roster: readonly RosterRow[],
  results: readonly ResultRow[],
): number {
  const names = new Set<string>();

  for (const row of roster) {
    const name = normalizeName(row.username);
    if (name) names.add(name);
  }

  for (const row of results) {
    const name = normalizeName(row.participant_username);
    if (name) names.add(name);
  }

  return names.size;
}

/**
 * A quiz is "relevant" to the admin when its owner is an existing teacher
 * account. Unowned or orphaned rows are left out of every admin figure; they
 * are hidden, never deleted. The admin quiz search applies the same rule
 * (requireColumns in lib/search/query-builder.ts: search_quizzes.teacher_id is
 * '' when there is no teacher row) so the table matches the cards.
 */
export function isRelevantQuiz(
  quiz: { teacher_id: string | null },
  ownerIds: ReadonlySet<string>,
): boolean {
  return quiz.teacher_id !== null && ownerIds.has(quiz.teacher_id);
}

function quizSummary(rows: readonly { status: string }[]): QuizStatusSummary {
  return rows.reduce<QuizStatusSummary>(
    (summary, row) => {
      summary.total += 1;

      if (row.status === "ready") {
        summary.ready += 1;
      } else if (row.status === "draft") {
        summary.draft += 1;
      } else if (row.status === "failed") {
        summary.failed += 1;
      }

      return summary;
    },
    { total: 0, ready: 0, draft: 0, failed: 0 },
  );
}

function teacherSummary(
  rows: readonly { status: string }[],
): TeacherStatusSummary {
  return rows.reduce<TeacherStatusSummary>(
    (summary, row) => {
      summary.total += 1;

      if (row.status === "approved") {
        summary.approved += 1;
      } else if (row.status === "pending") {
        summary.pending += 1;
      } else if (row.status === "rejected") {
        summary.rejected += 1;
      } else if (row.status === "suspended") {
        summary.suspended += 1;
      }

      return summary;
    },
    { total: 0, approved: 0, pending: 0, rejected: 0, suspended: 0 },
  );
}

function resultSummary(rows: readonly ResultRow[]): ResultSummary {
  if (rows.length === 0) {
    return { total: 0, average: 0 };
  }

  const total = rows.reduce(
    (sum, row) => sum + readNumber(row.percentage),
    0,
  );

  return {
    total: rows.length,
    average: Math.round((total / rows.length) * 10) / 10,
  };
}

function recentScores(
  rows: readonly ResultRow[],
  limit = 8,
): DashboardScore[] {
  return rows.slice(0, limit).map((row) => {
    const score = readNumber(row.percentage);

    return {
      id: row.attempt_id,
      student: row.participant_username,
      quizTitle: row.title,
      score,
      correct: readCount(row.correct_count),
      total: readCount(row.total_questions),
      status: scoreStatusLabel(score),
      completedAt: row.completed_at,
    };
  });
}

function quizDistributions(
  rows: readonly ResultRow[],
  limit = 6,
): ScoreDistribution[] {
  const scoresByQuiz = new Map<
    string,
    { scores: number[]; latest: number }
  >();

  for (const row of rows) {
    const entry = scoresByQuiz.get(row.title) ?? {
      scores: [],
      latest: 0,
    };
    entry.scores.push(readNumber(row.percentage));
    entry.latest = Math.max(entry.latest, Date.parse(row.completed_at) || 0);
    scoresByQuiz.set(row.title, entry);
  }

  return [...scoresByQuiz.entries()]
    .sort((left, right) => right[1].latest - left[1].latest)
    .slice(0, limit)
    .map(([quiz, entry]) => buildScoreDistribution(quiz, entry.scores))
    .filter((distribution): distribution is ScoreDistribution =>
      Boolean(distribution),
    );
}

function throwOnError(error: { message: string } | null, label: string): void {
  if (error) {
    throw new Error(`Unable to load ${label}: ${error.message}`);
  }
}

function recentQuizList(
  quizzes: readonly QuizRow[],
  teacherNameFor: (teacherId: string | null) => string,
): DashboardQuiz[] {
  return quizzes.slice(0, 5).map((quiz) => ({
    id: quiz.session_id,
    title: quiz.title || "Untitled quiz",
    status: quiz.status,
    teacherUsername: teacherNameFor(quiz.teacher_id),
    createdAt: quiz.created_at ?? "",
  }));
}

/** Results (student rows only: staff are removed by the view) for these quizzes. */
async function loadResultsForSessions(
  supabase: SupabaseClient<Database>,
  sessionIds: readonly string[],
): Promise<ResultRow[]> {
  const responses = await Promise.all(
    chunk(sessionIds).map((ids) =>
      supabase
        .from("student_quiz_results")
        .select(RESULT_COLUMNS)
        .in("session_id", ids)
        .order("completed_at", { ascending: false })
        .limit(RESULT_LIMIT),
    ),
  );

  const rows: ResultRow[] = [];

  for (const response of responses) {
    throwOnError(response.error, "quiz results");
    rows.push(...((response.data ?? []) as unknown as ResultRow[]));
  }

  return rows
    .sort(
      (left, right) =>
        (Date.parse(right.completed_at) || 0) -
        (Date.parse(left.completed_at) || 0),
    )
    .slice(0, RESULT_LIMIT);
}

/** Roster (students who joined) for these quizzes. */
async function loadRosterForSessions(
  supabase: SupabaseClient<Database>,
  sessionIds: readonly string[],
): Promise<RosterRow[]> {
  const responses = await Promise.all(
    chunk(sessionIds).map((ids) =>
      supabase
        .from("student_roster")
        .select("session_id, username")
        .in("session_id", ids)
        .limit(ROSTER_LIMIT),
    ),
  );

  const rows: RosterRow[] = [];

  for (const response of responses) {
    throwOnError(response.error, "students");
    rows.push(...((response.data ?? []) as unknown as RosterRow[]));
  }

  return rows;
}

export async function loadAdminDashboardData(
  supabase: SupabaseClient<Database>,
): Promise<AdminDashboardData> {
  // shortcut: summaries cap at 1,000 quizzes/results; switch to exact count
  // queries when a dataset grows past that.
  const [quizzesResult, teachersResult, studentAccountsResult, resultsResult] =
    await Promise.all([
      supabase
        .from("quiz_sessions")
        .select(QUIZ_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(QUIZ_LIMIT),
      supabase
        .from("teachers")
        .select("id, user_id, username, email, status, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      // Same rows the "Manage Student Accounts" table lists: login accounts,
      // not everyone who ever joined a quiz (that is the teacher-side count).
      supabase
        .from("account_profiles")
        .select("username, username_key", { count: "exact" })
        .eq("role", "student")
        .limit(5_000),
      supabase
        .from("student_quiz_results")
        .select(RESULT_COLUMNS)
        .order("completed_at", { ascending: false })
        .limit(RESULT_LIMIT),
    ]);

  throwOnError(quizzesResult.error, "quizzes");
  throwOnError(teachersResult.error, "teacher accounts");
  throwOnError(studentAccountsResult.error, "student accounts");
  throwOnError(resultsResult.error, "quiz results");

  const teachers = (teachersResult.data ?? []) as unknown as TeacherRow[];

  // quiz_sessions.teacher_id holds the teacher's auth user id.
  const ownerIds = new Set(teachers.map((teacher) => teacher.user_id));
  const quizzes = normalizeQuizzes(
    (quizzesResult.data ?? []) as unknown as QuizRow[],
  ).filter((quiz) => isRelevantQuiz(quiz, ownerIds));

  // Scores only for the quizzes that are shown, so no score points at a quiz
  // that is missing from the list.
  const sessionIds = new Set(quizzes.map((quiz) => quiz.session_id));
  const results = (
    (resultsResult.data ?? []) as unknown as ResultRow[]
  ).filter((row) => row.session_id !== null && sessionIds.has(row.session_id));

  // Scores that belong to a student login account, matched by username the
  // same way the student search view does it (username or username_key).
  const accountRows = (studentAccountsResult.data ?? []) as unknown as {
    username: string | null;
    username_key: string | null;
  }[];
  const accountNames = new Set<string>();

  for (const account of accountRows) {
    const name = normalizeName(account.username);
    const key = normalizeName(account.username_key);
    if (name) accountNames.add(name);
    if (key) accountNames.add(key);
  }

  const studentResults = results.filter((row) =>
    accountNames.has(normalizeName(row.participant_username)),
  );

  const teacherNameByUserId = new Map(
    teachers.map((teacher) => [
      teacher.user_id,
      teacher.username || teacher.email || `Teacher ${teacher.id}`,
    ]),
  );
  const quizCountByUserId = new Map<string, number>();

  for (const quiz of quizzes) {
    if (quiz.teacher_id) {
      quizCountByUserId.set(
        quiz.teacher_id,
        (quizCountByUserId.get(quiz.teacher_id) ?? 0) + 1,
      );
    }
  }

  return {
    quizzes: quizSummary(quizzes),
    teachers: teacherSummary(teachers),
    studentCount: studentAccountsResult.count ?? accountRows.length,
    results: resultSummary(results),
    studentResults: resultSummary(studentResults),
    studentRecentScores: recentScores(studentResults),
    recentQuizzes: recentQuizList(quizzes, (teacherId) =>
      !teacherId
        ? "Unassigned"
        : teacherNameByUserId.get(teacherId) ?? "Unknown teacher",
    ),
    recentScores: recentScores(results),
    distributions: quizDistributions(results),
    teacherAccounts: teachers.map((teacher) => ({
      id: String(teacher.id),
      username: teacher.username || teacher.email || `Teacher ${teacher.id}`,
      email: teacher.email || "",
      status: teacher.status,
      quizCount: quizCountByUserId.get(teacher.user_id) ?? 0,
      createdAt: teacher.created_at,
    })),
  };
}

export async function loadTeacherDashboardData(
  supabase: SupabaseClient<Database>,
  teacherId: number,
): Promise<TeacherDashboardData> {
  // quiz_sessions.teacher_id is the auth user id, but this function receives
  // teachers.id, so look the user id up first (falling back to the signed-in
  // user if the teachers row cannot be read).
  const { data: teacherRow, error: teacherError } = await supabase
    .from("teachers")
    .select("user_id")
    .eq("id", teacherId)
    .maybeSingle();

  throwOnError(teacherError, "teacher");

  let ownerId: string | null = teacherRow?.user_id ?? null;

  if (!ownerId) {
    const { data: auth } = await supabase.auth.getUser();
    ownerId = auth.user?.id ?? null;
  }

  const quizzesResult = ownerId
    ? await supabase
        .from("quiz_sessions")
        .select(QUIZ_COLUMNS)
        .eq("teacher_id", ownerId)
        .order("created_at", { ascending: false })
        .limit(QUIZ_LIMIT)
    : { data: [], error: null };

  throwOnError(quizzesResult.error, "quizzes");

  const quizzes = normalizeQuizzes(
    (quizzesResult.data ?? []) as unknown as QuizRow[],
  );
  const sessionIds = quizzes.map((quiz) => quiz.session_id);

  // Only this teacher's quizzes: results and roster are scoped by session.
  const [results, roster] = await Promise.all([
    loadResultsForSessions(supabase, sessionIds),
    loadRosterForSessions(supabase, sessionIds),
  ]);

  return {
    leaderboards: buildLeaderboards(results),
    quizzes: quizSummary(quizzes),
    studentCount: countDistinctStudents(roster, results),
    results: resultSummary(results),
    recentQuizzes: recentQuizList(quizzes, () => ""),
    recentScores: recentScores(results),
    distributions: quizDistributions(results),
  };
}
