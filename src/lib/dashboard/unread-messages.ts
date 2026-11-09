// lib/dashboard/unread-messages.ts
// Pure helpers for the "you have new messages" notice: parse the database
// summary and turn it into one short sentence.

export type UnreadItem = {
  attemptId: string;
  quizTitle: string;
  student: string;
  unread: number;
  latestAt: string;
};

export type UnreadSummary = {
  /** Every new message, even when `items` only lists the latest attempts. */
  total: number;
  /** The latest attempts that have new messages (at most 5). */
  items: UnreadItem[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function whole(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}

/**
 * Reads the summary from the database (snake_case) and also from our own API
 * response (camelCase), so parsing an already-parsed summary gives the same
 * result instead of silently dropping every item.
 */
export function parseUnreadSummary(raw: unknown): UnreadSummary {
  if (!isRecord(raw)) return { total: 0, items: [] };

  const items = Array.isArray(raw.items)
    ? raw.items.flatMap((entry): UnreadItem[] => {
        if (!isRecord(entry)) return [];

        const attemptId = text(entry.attempt_id) || text(entry.attemptId);
        const unread = whole(entry.unread);
        if (!attemptId || unread === 0) return [];

        return [
          {
            attemptId,
            quizTitle: text(entry.quiz_title) || text(entry.quizTitle) || "your quiz",
            student: text(entry.student) || "A student",
            unread,
            latestAt: text(entry.latest_at) || text(entry.latestAt),
          },
        ];
      })
    : [];

  return { total: whole(raw.total), items };
}

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

export type UnreadNotice = {
  message: string;
  /** Attempt to open, or null to open the list (several attempts). */
  attemptId: string | null;
};

/**
 * One sentence for the banner. The button opens the review when every new
 * message is on one attempt, and the list otherwise.
 */
export function unreadNotice(
  summary: UnreadSummary,
  viewer: "student" | "teacher",
): UnreadNotice | null {
  if (summary.total <= 0) return null;

  const { items, total } = summary;
  // The list holds at most 5 attempts; if its messages add up to less than the
  // total, more attempts have new messages than are listed.
  const listed = items.reduce((sum, item) => sum + item.unread, 0);
  const single = items.length === 1 && listed === total ? items[0] : null;

  if (viewer === "student") {
    return {
      message: single
        ? `You have ${plural(total, "new message", "new messages")} from your teacher about “${single.quizTitle}”.`
        : `You have ${plural(total, "new message", "new messages")} from your teacher.`,
      attemptId: single?.attemptId ?? null,
    };
  }

  const names = [...new Set(items.map((item) => item.student))];
  const shown = names.slice(0, 2).join(", ");
  const more = names.length - 2;
  const who = more > 0 ? `${shown} +${more} more` : shown;

  return {
    message: single
      ? `${single.student} sent you ${plural(total, "new message", "new messages")} about “${single.quizTitle}”.`
      : `${plural(total, "new message", "new messages")} from students: ${who}.`,
    attemptId: single?.attemptId ?? null,
  };
}
