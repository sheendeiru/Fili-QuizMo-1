"use client";

import { PixelButton } from "@/components/ui/pixel-primitives";
import type { PerformanceNotice } from "@/lib/dashboard/performance-notice";

const TONE = {
  warning: { box: "bg-accent", icon: "!" },
  praise: { box: "bg-primary", icon: "★" },
} as const;

/**
 * Slim one-line notices: a heads-up for low scores, praise for high ones.
 * Renders nothing when there is nothing to say, so the dashboard stays compact.
 * Only warnings get a button (to review the answers).
 */
export function PerformanceNotices({
  notices,
  actionLabel,
  onAction,
}: {
  notices: PerformanceNotice[];
  actionLabel: string;
  onAction: (notice: PerformanceNotice) => void;
}) {
  if (notices.length === 0) return null;

  return (
    <section aria-label="Score notices" className="space-y-1.5">
      {notices.map((notice) => {
        const tone = TONE[notice.tone];

        return (
          <div
            key={notice.tone}
            role="status"
            className={`flex flex-wrap items-center gap-x-2 gap-y-1.5 border-2 border-ink px-2.5 py-1.5 text-xs text-ink sm:text-sm ${tone.box}`}
          >
            <span
              aria-hidden="true"
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center border-2 border-ink bg-surface text-sm font-bold"
            >
              {tone.icon}
            </span>
            <p className="min-w-0 flex-1 basis-40 break-words">
              <strong>{notice.title}</strong> {notice.message}
            </p>
            {notice.tone === "warning" ? (
              <PixelButton
                type="button"
                size="sm"
                variant="neutral"
                className="shrink-0 whitespace-nowrap"
                onClick={() => onAction(notice)}
              >
                {actionLabel}
              </PixelButton>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
