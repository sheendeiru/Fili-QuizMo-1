"use client";

import { useEffect, useMemo, useState } from "react";
import { PixelButton } from "@/components/ui/pixel-primitives";
import {
  parseUnreadSummary,
  unreadNotice,
  type UnreadSummary,
} from "@/lib/dashboard/unread-messages";

/**
 * One slim line on the dashboard when someone has written to you since you last
 * opened that quiz's messages. It checks every time the page is shown, stays
 * until the messages are opened, and shows nothing when there is nothing new
 * (or when the check fails, so it never gets in the way).
 */
export function UnreadMessagesNotice({
  viewer,
  onOpen,
}: {
  viewer: "student" | "teacher";
  /** attemptId opens that review; null opens the list of quizzes. */
  onOpen: (attemptId: string | null) => void;
}) {
  const [summary, setSummary] = useState<UnreadSummary | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/assessment/messages", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) return;

        const body: unknown = await response.json();

        if (typeof body === "object" && body !== null && "unread" in body) {
          setSummary(parseUnreadSummary(body.unread));
        }
      })
      .catch(() => {
        /* the notice is optional */
      });

    return () => controller.abort();
  }, []);

  const notice = useMemo(
    () => (summary ? unreadNotice(summary, viewer) : null),
    [summary, viewer],
  );

  if (!notice) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-2 border-ink bg-surface px-2.5 py-1.5 text-xs text-ink sm:text-sm"
    >
      <span
        aria-hidden="true"
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center border-2 border-ink bg-accent-dark text-sm font-bold"
      >
        ✉
      </span>
      <p className="min-w-0 flex-1 basis-40 break-words">
        <strong>New message!</strong> {notice.message}
      </p>
      <PixelButton
        type="button"
        size="sm"
        variant="primary"
        className="shrink-0 whitespace-nowrap"
        onClick={() => onOpen(notice.attemptId)}
      >
        Read
      </PixelButton>
    </div>
  );
}
