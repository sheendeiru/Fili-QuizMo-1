// lib/dashboard/performance-notice.ts
// Pure helpers that turn recent scores into at most one or two short notices:
// a gentle warning for a low score, or a word of praise for a high one.
//
// To keep dashboards uncluttered, only attempts from the last RECENT_DAYS days
// count, and only each student's latest attempt is looked at. Scores in the
// middle (LOW_SCORE_BELOW to HIGH_SCORE_AT_LEAST) show nothing at all.

import { formatRawScore } from "@/lib/dashboard/raw-score";

/** A latest score below this percentage gets a "needs help" notice. */
export const LOW_SCORE_BELOW = 50;
/** A latest score at or above this percentage gets a praise notice. */
export const HIGH_SCORE_AT_LEAST = 90;
/** Older attempts are ignored so a notice never nags about old results. */
export const RECENT_DAYS = 14;

export type NoticeTone = "warning" | "praise";

export type PerformanceNotice = {
  tone: NoticeTone;
  /** Short bold lead-in, e.g. "Let's try again!" */
  title: string;
  message: string;
  /**
   * The attempt the "Review" button should open. Null when the notice is about
   * several attempts (the button then opens the list).
   */
  attemptId: string | null;
};

export type NoticeRow = {
  id: string | null;
  student?: string | null;
  title: string | null;
  percentage: number | null;
  correct: number | null;
  total: number | null;
  completedAt: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function completedTime(row: NoticeRow): number {
  const time = Date.parse(row.completedAt ?? "");
  return Number.isNaN(time) ? 0 : time;
}

function isRecent(row: NoticeRow, now: number): boolean {
  const time = completedTime(row);
  return time > 0 && now - time <= RECENT_DAYS * DAY_MS;
}

function hasScore(row: NoticeRow): row is NoticeRow & { percentage: number } {
  return row.percentage !== null && Number.isFinite(row.percentage);
}

/** "3/10" when the counts are known, otherwise "30%". */
function scoreText(row: NoticeRow & { percentage: number }): string {
  return (
    formatRawScore(row.correct, row.total) ?? `${Math.round(row.percentage)}%`
  );
}

function quoted(title: string | null): string {
  return title ? `“${title}”` : "your last quiz";
}

/** One notice for a student, based on their latest recent attempt. */
export function studentNotice(
  rows: readonly NoticeRow[],
  now: number,
): PerformanceNotice | null {
  const latest = rows
    .filter(hasScore)
    .filter((row) => isRecent(row, now))
    .sort((left, right) => completedTime(right) - completedTime(left))[0];

  if (!latest) return null;

  if (latest.percentage < LOW_SCORE_BELOW) {
    return {
      tone: "warning",
      title: "Let’s try again!",
      message: `You got ${scoreText(latest)} on ${quoted(latest.title)}. Check your answers to see what to fix.`,
      attemptId: latest.id,
    };
  }

  if (latest.percentage >= HIGH_SCORE_AT_LEAST) {
    return {
      tone: "praise",
      title: "Great job!",
      message: `You got ${scoreText(latest)} on ${quoted(latest.title)}. Keep it up!`,
      attemptId: null,
    };
  }

  return null;
}

function nameList(names: string[]): string {
  const shown = names.slice(0, 2).join(", ");
  const more = names.length - 2;
  return more > 0 ? `${shown} +${more} more` : shown;
}

/**
 * Up to two notices for a teacher: students whose latest recent score is low
 * (warning first), and students whose latest recent score is high.
 */
export function teacherNotices(
  rows: readonly NoticeRow[],
  now: number,
): PerformanceNotice[] {
  // Each student's latest recent attempt.
  const latestByStudent = new Map<string, NoticeRow & { percentage: number }>();

  for (const row of rows) {
    if (!hasScore(row) || !isRecent(row, now)) continue;

    const key = (row.student ?? "").trim().toLowerCase();
    if (key === "") continue;

    const current = latestByStudent.get(key);
    if (!current || completedTime(row) > completedTime(current)) {
      latestByStudent.set(key, row);
    }
  }

  const latest = [...latestByStudent.values()];
  const low = latest
    .filter((row) => row.percentage < LOW_SCORE_BELOW)
    .sort((left, right) => left.percentage - right.percentage);
  const high = latest.filter((row) => row.percentage >= HIGH_SCORE_AT_LEAST);

  const notices: PerformanceNotice[] = [];

  if (low.length > 0) {
    const label = low.map((row) => `${row.student} (${scoreText(row)})`);

    notices.push({
      tone: "warning",
      title: low.length === 1 ? "1 student needs help:" : `${low.length} students need help:`,
      message: nameList(label),
      // One student: open their answers directly. Several: open the list.
      attemptId: low.length === 1 ? low[0].id : null,
    });
  }

  if (high.length > 0) {
    notices.push({
      tone: "praise",
      title: "Well done!",
      message:
        high.length === 1
          ? `1 student scored ${HIGH_SCORE_AT_LEAST}% or higher recently.`
          : `${high.length} students scored ${HIGH_SCORE_AT_LEAST}% or higher recently.`,
      attemptId: null,
    });
  }

  return notices;
}
