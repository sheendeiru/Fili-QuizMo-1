// lib/dashboard/badges.ts
// Pure helpers: work out which badges a student has earned from their quiz
// results. Nothing is stored; badges are recalculated from the attempts the
// dashboard already loads, so they always match the scores shown elsewhere.
//
// The rules (all thresholds are in BADGE_RULES so they can be tuned in one
// place, and the text on screen is built from them):
//   First Steps      finish 1 quiz
//   Quiz Regular     finish 5 quizzes
//   Sharp Mind       score 90% or more on a quiz
//   Perfect Score    score 100% on a quiz
//   Steady Scorer    score 75% or more on 3 quizzes in a row
//   All-Rounder      score 80% or more on 3 different quizzes
//   Comeback Kid     retake a quiz and beat your first score by 20+ points

export const BADGE_RULES = {
  regularQuizzes: 5,
  sharpScore: 90,
  perfectScore: 100,
  steadyScore: 75,
  steadyRun: 3,
  allRounderScore: 80,
  allRounderQuizzes: 3,
  comebackGain: 20,
} as const;

export type BadgeId =
  | "first_steps"
  | "regular"
  | "sharp"
  | "perfect"
  | "steady"
  | "all_rounder"
  | "comeback";

export type Badge = {
  id: BadgeId;
  name: string;
  /** Short symbol shown in the badge tile. */
  icon: string;
  /** How to earn it, in one short line. */
  rule: string;
  earned: boolean;
  /** For badges not earned yet: how close the student is. */
  progress: string | null;
};

export type BadgeRow = {
  title: string | null;
  percentage: number | null;
  completedAt: string | null;
};

type Scored = { title: string; percentage: number; time: number };

function toScored(rows: readonly BadgeRow[]): Scored[] {
  return rows
    .filter(
      (row): row is BadgeRow & { percentage: number } =>
        row.percentage !== null && Number.isFinite(row.percentage),
    )
    .map((row) => ({
      title: row.title ?? "Untitled quiz",
      percentage: row.percentage,
      time: Date.parse(row.completedAt ?? "") || 0,
    }))
    // Oldest first, so runs and "first score" make sense.
    .sort((left, right) => left.time - right.time);
}

/** Longest run of consecutive attempts at or above `minimum`. */
function longestRun(scored: readonly Scored[], minimum: number): number {
  let best = 0;
  let current = 0;

  for (const attempt of scored) {
    current = attempt.percentage >= minimum ? current + 1 : 0;
    best = Math.max(best, current);
  }

  return best;
}

/** Biggest gain over a first attempt, across quizzes taken more than once. */
function biggestComeback(scored: readonly Scored[]): number {
  const firstByQuiz = new Map<string, number>();
  let best = 0;

  for (const attempt of scored) {
    const first = firstByQuiz.get(attempt.title);

    if (first === undefined) {
      firstByQuiz.set(attempt.title, attempt.percentage);
    } else {
      best = Math.max(best, attempt.percentage - first);
    }
  }

  return Math.round(best);
}

/** Different quizzes where the best score reaches `minimum`. */
function quizzesAtOrAbove(scored: readonly Scored[], minimum: number): number {
  const bestByQuiz = new Map<string, number>();

  for (const attempt of scored) {
    bestByQuiz.set(
      attempt.title,
      Math.max(bestByQuiz.get(attempt.title) ?? 0, attempt.percentage),
    );
  }

  return [...bestByQuiz.values()].filter((best) => best >= minimum).length;
}

/**
 * @param rows           the attempts the dashboard has loaded (latest first or
 *                       any order)
 * @param totalAttempts  how many quizzes the student has finished in all
 *                       (can be more than `rows` when only the latest are loaded)
 */
export function buildBadges(
  rows: readonly BadgeRow[],
  totalAttempts: number,
): Badge[] {
  const scored = toScored(rows);
  const finished = Math.max(totalAttempts, rows.length);
  const best = scored.reduce((top, row) => Math.max(top, row.percentage), 0);
  const run = longestRun(scored, BADGE_RULES.steadyScore);
  const rounded = quizzesAtOrAbove(scored, BADGE_RULES.allRounderScore);
  const comeback = biggestComeback(scored);

  const badge = (
    id: BadgeId,
    name: string,
    icon: string,
    rule: string,
    earned: boolean,
    progress: string,
  ): Badge => ({ id, name, icon, rule, earned, progress: earned ? null : progress });

  return [
    badge(
      "first_steps",
      "First Steps",
      "▶",
      "Finish your first quiz",
      finished >= 1,
      "Take a quiz to start",
    ),
    badge(
      "regular",
      "Quiz Regular",
      "◆",
      `Finish ${BADGE_RULES.regularQuizzes} quizzes`,
      finished >= BADGE_RULES.regularQuizzes,
      `${finished} of ${BADGE_RULES.regularQuizzes} done`,
    ),
    badge(
      "sharp",
      "Sharp Mind",
      "★",
      `Score ${BADGE_RULES.sharpScore}% or more`,
      best >= BADGE_RULES.sharpScore,
      scored.length > 0 ? `Best so far: ${Math.round(best)}%` : "No score yet",
    ),
    badge(
      "perfect",
      "Perfect Score",
      "100",
      "Get every answer right",
      best >= BADGE_RULES.perfectScore,
      scored.length > 0 ? `Best so far: ${Math.round(best)}%` : "No score yet",
    ),
    badge(
      "steady",
      "Steady Scorer",
      "✓✓✓",
      `Score ${BADGE_RULES.steadyScore}%+ ${BADGE_RULES.steadyRun} quizzes in a row`,
      run >= BADGE_RULES.steadyRun,
      `Best run: ${Math.min(run, BADGE_RULES.steadyRun)} of ${BADGE_RULES.steadyRun}`,
    ),
    badge(
      "all_rounder",
      "All-Rounder",
      "●●●",
      `Score ${BADGE_RULES.allRounderScore}%+ on ${BADGE_RULES.allRounderQuizzes} different quizzes`,
      rounded >= BADGE_RULES.allRounderQuizzes,
      `${Math.min(rounded, BADGE_RULES.allRounderQuizzes)} of ${BADGE_RULES.allRounderQuizzes} quizzes`,
    ),
    badge(
      "comeback",
      "Comeback Kid",
      "▲",
      `Retake a quiz and beat your first score by ${BADGE_RULES.comebackGain}+ points`,
      comeback >= BADGE_RULES.comebackGain,
      comeback > 0
        ? `Biggest gain so far: +${comeback} points`
        : "Retake a quiz to try",
    ),
  ];
}
