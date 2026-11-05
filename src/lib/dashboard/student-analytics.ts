// lib/dashboard/student-analytics.ts
// Pure helpers: turn my_quiz_history rows into the numbers the student dashboard charts need.
// Assumes `percentage` is 0-100 (same scale the dashboards print with a "%" sign).

/** The columns the analytics need. StudentHistoryRow already satisfies this. */
export type AttemptRow = {
  quiz_title: string | null;
  correct_count: number | null;
  total_questions: number | null;
  answered_count: number | null;
  percentage: number | null;
  completed_at: string | null;
};

export type StudentAnalytics = {
  kpis: {
    average: number;
    best: number;
    latest: number;
    latestQuiz: string;
  };
  /** Oldest -> newest, last `trendSize` completed attempts. Format `date` in the UI. */
  trend: { date: string; quiz: string; percentage: number }[];
  /** Average % per quiz, best first. */
  byQuiz: { quiz: string; average: number; attempts: number }[];
  /** Quizzes taken 2+ times: first vs latest score, biggest gain first. */
  retakes: { quiz: string; first: number; latest: number; change: number }[];
  /** Newest completed attempt split into correct / wrong / skipped. */
  latestBreakdown: {
    quiz: string;
    correct: number;
    wrong: number;
    skipped: number;
    total: number;
  } | null;
  bands: { label: string; count: number }[];
};

type CompletedRow = AttemptRow & { percentage: number; completed_at: string };

const round1 = (n: number) => Math.round(n * 10) / 10;
const mean = (values: number[]) =>
  values.reduce((sum, v) => sum + v, 0) / values.length;

/**
 * @param rows  summaryHistory (latest attempts, any order)
 * Returns null when there is no completed attempt yet (show an empty state).
 */
export function buildStudentAnalytics(
  rows: AttemptRow[],
  trendSize = 10,
): StudentAnalytics | null {
  // In-progress attempts have no percentage / completed_at: keep them out of the charts.
  const done = rows
    .filter(
      (r): r is CompletedRow =>
        r.percentage !== null &&
        Number.isFinite(r.percentage) &&
        r.completed_at !== null &&
        !Number.isNaN(Date.parse(r.completed_at)),
    )
    .sort((a, b) => Date.parse(a.completed_at) - Date.parse(b.completed_at));

  if (done.length === 0) return null;

  const title = (r: AttemptRow) => r.quiz_title ?? "Untitled quiz";
  const percentages = done.map((r) => r.percentage);

  const groups = new Map<string, CompletedRow[]>();
  for (const row of done) {
    const key = title(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const byQuiz = [...groups]
    .map(([quiz, list]) => ({
      quiz,
      average: round1(mean(list.map((r) => r.percentage))),
      attempts: list.length,
    }))
    .sort((a, b) => b.average - a.average);

  const retakes = [...groups]
    .filter(([, list]) => list.length >= 2)
    .map(([quiz, list]) => {
      const first = list[0].percentage;
      const latest = list[list.length - 1].percentage;
      return { quiz, first, latest, change: round1(latest - first) };
    })
    .sort((a, b) => b.change - a.change);

  const last = done[done.length - 1];
  const total = last.total_questions ?? 0;
  const correct = last.correct_count ?? 0;
  const answered = last.answered_count ?? correct;

  const bandDefs: [string, (p: number) => boolean][] = [
    ["90-100%", (p) => p >= 90],
    ["75-89%", (p) => p >= 75 && p < 90],
    ["50-74%", (p) => p >= 50 && p < 75],
    ["Below 50%", (p) => p < 50],
  ];

  return {
    kpis: {
      average: round1(mean(percentages)),
      best: Math.max(...percentages),
      latest: last.percentage,
      latestQuiz: title(last),
    },
    trend: done.slice(-trendSize).map((r) => ({
      date: r.completed_at,
      quiz: title(r),
      percentage: r.percentage,
    })),
    byQuiz: byQuiz.slice(0, 8),
    retakes: retakes.slice(0, 6),
    latestBreakdown:
      total > 0
        ? {
            quiz: title(last),
            correct,
            wrong: Math.max(answered - correct, 0),
            skipped: Math.max(total - answered, 0),
            total,
          }
        : null,
    bands: bandDefs.map(([label, test]) => ({
      label,
      count: percentages.filter(test).length,
    })),
  };
}
