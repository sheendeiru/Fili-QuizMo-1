// lib/dashboard/leaderboard.ts
// Pure helpers: rank students from quiz_results rows. Scores are 0-100 percentages.
// Ranking still uses the percentage; `bestRaw` is only for display (e.g. "8/10").

import { formatRawScore } from "./raw-score";

export type LeaderboardEntry = {
  rank: number;
  student: string;
  /** Average % across the attempts counted on this board. */
  average: number;
  /** Highest single-attempt %. */
  best: number;
  /** Raw score of the best attempt, e.g. "8/10". null if counts are missing. */
  bestRaw: string | null;
  attempts: number;
  lastCompletedAt: string;
};

export type Leaderboard = {
  /** null = all quizzes combined. */
  quiz: string | null;
  /** Overall board ranks by average; a single-quiz board ranks by best attempt. */
  rankedBy: "average" | "best";
  entries: LeaderboardEntry[];
};

export type LeaderboardData = {
  overall: Leaderboard;
  byQuiz: Leaderboard[];
};

type ResultLike = {
  title: string;
  participant_username: string;
  percentage: number | string;
  correct_count?: number | string | null;
  total_questions?: number | string | null;
  completed_at: string;
};

const MAX_ENTRIES = 10;
const MAX_QUIZZES = 6;

const round1 = (n: number) => Math.round(n * 10) / 10;

function toScore(value: number | string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rankStudents(
  rows: readonly ResultLike[],
  rankedBy: "average" | "best",
  limit = MAX_ENTRIES,
): LeaderboardEntry[] {
  const byStudent = new Map<
    string,
    {
      student: string;
      scores: number[];
      lastTime: number;
      lastIso: string;
      bestScore: number;
      bestRaw: string | null;
    }
  >();

  for (const row of rows) {
    const name = row.participant_username?.trim();
    if (!name) continue;

    const key = name.toLowerCase();
    const entry = byStudent.get(key) ?? {
      student: name,
      scores: [],
      lastTime: 0,
      lastIso: row.completed_at,
      bestScore: Number.NEGATIVE_INFINITY,
      bestRaw: null,
    };
    const time = Date.parse(row.completed_at) || 0;
    const score = toScore(row.percentage);
    const raw = formatRawScore(row.correct_count, row.total_questions);

    // Keep the raw score of the highest-percentage attempt (first one on a tie).
    if (score > entry.bestScore || (score === entry.bestScore && !entry.bestRaw)) {
      entry.bestScore = score;
      entry.bestRaw = raw;
    }

    entry.scores.push(score);
    if (time >= entry.lastTime) {
      entry.lastTime = time;
      entry.lastIso = row.completed_at;
    }
    byStudent.set(key, entry);
  }

  const stats = [...byStudent.values()].map((entry) => ({
    student: entry.student,
    average: round1(
      entry.scores.reduce((sum, score) => sum + score, 0) / entry.scores.length,
    ),
    best: Math.max(...entry.scores),
    bestRaw: entry.bestRaw,
    attempts: entry.scores.length,
    lastCompletedAt: entry.lastIso,
  }));

  const primary = (s: (typeof stats)[number]) =>
    rankedBy === "best" ? s.best : s.average;
  const secondary = (s: (typeof stats)[number]) =>
    rankedBy === "best" ? s.average : s.best;

  stats.sort(
    (a, b) =>
      primary(b) - primary(a) ||
      secondary(b) - secondary(a) ||
      b.attempts - a.attempts ||
      a.student.localeCompare(b.student),
  );

  const ranked: LeaderboardEntry[] = [];
  stats.slice(0, limit).forEach((current, index) => {
    const previous = ranked[index - 1];
    const tied =
      previous !== undefined &&
      primary(previous) === primary(current) &&
      secondary(previous) === secondary(current) &&
      previous.attempts === current.attempts;

    ranked.push({ rank: tied ? previous.rank : index + 1, ...current });
  });

  return ranked;
}

export function buildLeaderboards(
  rows: readonly ResultLike[],
): LeaderboardData {
  const byTitle = new Map<string, { rows: ResultLike[]; latest: number }>();

  for (const row of rows) {
    const group = byTitle.get(row.title) ?? { rows: [], latest: 0 };
    group.rows.push(row);
    group.latest = Math.max(group.latest, Date.parse(row.completed_at) || 0);
    byTitle.set(row.title, group);
  }

  const byQuiz = [...byTitle.entries()]
    .sort((left, right) => right[1].latest - left[1].latest)
    .slice(0, MAX_QUIZZES)
    .map(
      ([quiz, group]): Leaderboard => ({
        quiz,
        rankedBy: "best",
        entries: rankStudents(group.rows, "best"),
      }),
    )
    .filter((board) => board.entries.length > 0);

  return {
    overall: {
      quiz: null,
      rankedBy: "average",
      entries: rankStudents(rows, "average"),
    },
    byQuiz,
  };
}
