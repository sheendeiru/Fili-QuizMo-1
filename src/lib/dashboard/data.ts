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
  studentCount: number;
  results: ResultSummary;
  recentQuizzes: DashboardQuiz[];
  recentScores: DashboardScore[];
  distributions: ScoreDistribution[];
  teacherAccounts: DashboardTeacher[];
};

export type TeacherDashboardData = {
  quizzes: QuizStatusSummary;
  studentCount: number;
  results: ResultSummary;
  recentQuizzes: DashboardQuiz[];
  recentScores: DashboardScore[];
  distributions: ScoreDistribution[];
  leaderboards: LeaderboardData;
};

type QuizRow = {
  session_id: string;
  title: string | null;
  status: string;
  teacher_id: number | null;
  created_at: string;
};

type TeacherRow = {
  id: number;
  username: string | null;
  email: string | null;
  status: string;
  created_at: string;
};

type ResultRow = {
  attempt_id: string;
  title: string;
  participant_username: string;
  percentage: number | string;
  completed_at: string;
};

function readNumber(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
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

export async function loadAdminDashboardData(
  supabase: SupabaseClient<Database>,
): Promise<AdminDashboardData> {
  // shortcut: summaries cap at 1,000 result rows; switch to exact count
  // queries when a dashboard dataset grows past that.
  const [quizzesResult, teachersResult, studentsResult, resultsResult] =
    await Promise.all([
      supabase
        .from("quizzes")
        .select("session_id, title, status, teacher_id, created_at")
        .order("created_at", { ascending: false })
        .limit(1_000),
      supabase
        .from("teachers")
        .select("id, username, email, status, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("student_roster").select("id", { count: "exact", head: true }),
      supabase
        .from("student_quiz_results")
        .select(
          "attempt_id, title, participant_username, percentage, completed_at",
        )
        .order("completed_at", { ascending: false })
        .limit(1_000),
    ]);

  throwOnError(quizzesResult.error, "quizzes");
  throwOnError(teachersResult.error, "teacher accounts");
  throwOnError(studentsResult.error, "students");
  throwOnError(resultsResult.error, "quiz results");

  const quizzes = (quizzesResult.data ?? []) as QuizRow[];
  const teachers = (teachersResult.data ?? []) as TeacherRow[];
  const results = (resultsResult.data ?? []) as ResultRow[];
  const teacherNameById = new Map(
    teachers.map((teacher) => [
      teacher.id,
      teacher.username || teacher.email || `Teacher ${teacher.id}`,
    ]),
  );
  const quizCountByTeacher = new Map<number, number>();

  for (const quiz of quizzes) {
    if (quiz.teacher_id !== null) {
      quizCountByTeacher.set(
        quiz.teacher_id,
        (quizCountByTeacher.get(quiz.teacher_id) ?? 0) + 1,
      );
    }
  }

  return {
    quizzes: quizSummary(quizzes),
    teachers: teacherSummary(teachers),
    studentCount: studentsResult.count ?? 0,
    results: resultSummary(results),
    recentQuizzes: quizzes.slice(0, 5).map((quiz) => ({
      id: quiz.session_id,
      title: quiz.title || "Untitled quiz",
      status: quiz.status,
      teacherUsername:
        quiz.teacher_id === null
          ? "Unassigned"
          : teacherNameById.get(quiz.teacher_id) ?? "Unknown teacher",
      createdAt: quiz.created_at,
    })),
    recentScores: recentScores(results),
    distributions: quizDistributions(results),
    teacherAccounts: teachers.map((teacher) => ({
      id: String(teacher.id),
      username: teacher.username || teacher.email || `Teacher ${teacher.id}`,
      email: teacher.email || "",
      status: teacher.status,
      quizCount: quizCountByTeacher.get(teacher.id) ?? 0,
      createdAt: teacher.created_at,
    })),
  };
}

export async function loadTeacherDashboardData(
  supabase: SupabaseClient<Database>,
  teacherId: number,
): Promise<TeacherDashboardData> {
  // shortcut: summaries cap at 1,000-5,000 rows; switch to exact count
  // queries when a dashboard dataset grows past that.
  const [quizzesResult, studentsResult, resultsResult] = await Promise.all([
    supabase
      .from("quizzes")
      .select("session_id, title, status, teacher_id, created_at")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false })
      .limit(1_000),
    supabase
      .from("student_roster")
      .select("id, session_id, username")
      .limit(5_000),
    supabase
      .from("student_quiz_results")
      .select(
        "attempt_id, title, participant_username, percentage, completed_at",
      )
      .order("completed_at", { ascending: false })
      .limit(1_000),
  ]);

  throwOnError(quizzesResult.error, "quizzes");
  throwOnError(studentsResult.error, "students");
  throwOnError(resultsResult.error, "quiz results");

  const quizzes = (quizzesResult.data ?? []) as QuizRow[];
  const sessionIds = new Set(quizzes.map((quiz) => quiz.session_id));
  const rosterRows = (studentsResult.data ?? []).filter(
  (student) =>
    student.session_id !== null && sessionIds.has(student.session_id),
  );
  const uniqueStudents = new Set(
  rosterRows
    .map((student) => (student.username ?? "").trim().toLowerCase())
    .filter((name) => name !== ""),
  );

  const results = (resultsResult.data ?? []) as ResultRow[];

  return {
    leaderboards: buildLeaderboards(results),
    quizzes: quizSummary(quizzes),
    studentCount: uniqueStudents.size,
    results: resultSummary(results),
    recentQuizzes: quizzes.slice(0, 5).map((quiz) => ({
      id: quiz.session_id,
      title: quiz.title || "Untitled quiz",
      status: quiz.status,
      teacherUsername: "",
      createdAt: quiz.created_at,
    })),
    recentScores: recentScores(results),
    distributions: quizDistributions(results),
  };
}
