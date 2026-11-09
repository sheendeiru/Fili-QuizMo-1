// lib/dashboard/attempt-history.ts
// Pure helpers for the teacher's History view: one row per student and quiz,
// with every score in the order it was taken (oldest to newest).
//
// Quizzes can allow any number of retakes, so a student can have many attempts
// on one quiz. The dashboard therefore loads at most
// MAX_ATTEMPTS_PER_STUDENT_QUIZ of the latest attempts per student and quiz,
// and each row says how many earlier attempts are not shown.

/** Latest attempts kept per student and quiz (see attemptList in data.ts). */
export const MAX_ATTEMPTS_PER_STUDENT_QUIZ = 30;

export type HistoryAttempt = {
  id: string;
  student: string;
  quizTitle: string;
  correct: number | null;
  total: number | null;
  percentage: number;
  completedAt: string;
  /** 1 for a student's first try on that quiz. Null when unknown. */
  attemptNumber?: number | null;
};

export type HistoryScore = {
  id: string;
  /** "8/10", or the percentage ("80%") when the counts are missing. */
  label: string;
  percentage: number;
  completedAt: string;
  /** Real attempt number when known, otherwise the position in this list. */
  attemptNumber: number;
};

export type HistoryRow = {
  key: string;
  student: string;
  quizTitle: string;
  /** Oldest first. */
  scores: HistoryScore[];
  /** The highest score (the most recent one on a tie). */
  best: HistoryScore;
  latest: HistoryScore;
  /** All attempts the student has made on this quiz, when it can be told. */
  attemptsTaken: number;
  /** Attempts before the first one shown (not loaded). */
  earlierNotShown: number;
  /** Latest minus first score shown, in percentage points. Null for one attempt. */
  change: number | null;
};

function time(value: string): number {
  return Date.parse(value) || 0;
}

function scoreLabel(attempt: HistoryAttempt): string {
  return attempt.correct !== null && attempt.total !== null && attempt.total > 0
    ? `${attempt.correct}/${attempt.total}`
    : `${Math.round(attempt.percentage)}%`;
}

function validNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function buildAttemptHistory(
  attempts: readonly HistoryAttempt[],
): HistoryRow[] {
  const groups = new Map<
    string,
    { student: string; quizTitle: string; items: HistoryAttempt[] }
  >();

  for (const attempt of attempts) {
    const student = attempt.student.trim();
    if (student === "") continue;

    const key = `${student.toLowerCase()}\u0000${attempt.quizTitle}`;
    const group = groups.get(key) ?? {
      student,
      quizTitle: attempt.quizTitle,
      items: [],
    };

    group.items.push(attempt);
    groups.set(key, group);
  }

  return [...groups.entries()].map(([key, group]): HistoryRow => {
    const ordered = [...group.items].sort(
      (left, right) =>
        time(left.completedAt) - time(right.completedAt) ||
        (left.attemptNumber ?? 0) - (right.attemptNumber ?? 0),
    );
    const numbered = ordered.every((item) => validNumber(item.attemptNumber));

    const scores = ordered.map(
      (item, index): HistoryScore => ({
        id: item.id,
        label: scoreLabel(item),
        percentage: item.percentage,
        completedAt: item.completedAt,
        attemptNumber: numbered ? (item.attemptNumber as number) : index + 1,
      }),
    );

    const first = scores[0];
    const latest = scores[scores.length - 1];
    const best = scores.reduce(
      (top, score) => (score.percentage >= top.percentage ? score : top),
      first,
    );
    const earlierNotShown = numbered ? Math.max(0, first.attemptNumber - 1) : 0;

    return {
      key,
      student: group.student,
      quizTitle: group.quizTitle,
      scores,
      best,
      latest,
      attemptsTaken: Math.max(latest.attemptNumber, scores.length),
      earlierNotShown,
      change:
        scores.length > 1 ? Math.round(latest.percentage - first.percentage) : null,
    };
  });
}

export type HistoryFilter = "all" | "retakes" | "low";

/**
 * all      every student and quiz
 * retakes  more than one attempt
 * low      the latest score is below `lowBelow` (needs a look)
 */
export function filterHistory(
  rows: readonly HistoryRow[],
  filter: HistoryFilter,
  lowBelow: number,
): HistoryRow[] {
  switch (filter) {
    case "retakes":
      return rows.filter((row) => row.attemptsTaken > 1);
    case "low":
      return rows.filter((row) => row.latest.percentage < lowBelow);
    default:
      return [...rows];
  }
}

export type HistorySort = "name" | "attempts" | "improved" | "dropped" | "recent";

/** Rows without a change (one attempt) always go last for improved/dropped. */
export function sortHistory(
  rows: readonly HistoryRow[],
  sort: HistorySort,
): HistoryRow[] {
  const byName = (left: HistoryRow, right: HistoryRow) =>
    left.student.localeCompare(right.student) ||
    left.quizTitle.localeCompare(right.quizTitle);

  const byChange = (direction: 1 | -1) => (left: HistoryRow, right: HistoryRow) => {
    if (left.change === null && right.change === null) return byName(left, right);
    if (left.change === null) return 1;
    if (right.change === null) return -1;
    return (right.change - left.change) * direction || byName(left, right);
  };

  return [...rows].sort((left, right) => {
    switch (sort) {
      case "attempts":
        return right.attemptsTaken - left.attemptsTaken || byName(left, right);
      case "improved":
        return byChange(1)(left, right);
      case "dropped":
        return byChange(-1)(left, right);
      case "recent":
        return (
          time(right.latest.completedAt) - time(left.latest.completedAt) ||
          byName(left, right)
        );
      default:
        return byName(left, right);
    }
  });
}
