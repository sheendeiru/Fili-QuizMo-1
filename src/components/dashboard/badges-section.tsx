"use client";

import { PixelCard } from "@/components/ui/pixel-primitives";
import type { Badge } from "@/lib/dashboard/badges";

/**
 * Compact badge board: earned badges are bright, the rest are greyed out with
 * how to earn them and how close the student is.
 */
export function BadgesSection({
  badges,
  basedOn,
}: {
  badges: Badge[];
  /** How many recent attempts the badges were counted from. */
  basedOn: number;
}) {
  const earned = badges.filter((badge) => badge.earned).length;

  return (
    <div className="space-y-2 sm:space-y-3">
      <section>
        <h2 className="text-xl font-bold text-foreground">Badges</h2>
        <p className="mt-1 text-sm text-px-muted">
          You have earned {earned} of {badges.length} badges.
          {earned === 0 ? " Finish a quiz to get your first one!" : ""}
        </p>
      </section>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
        {badges.map((badge) => (
          <li key={badge.id}>
            <PixelCard
              as="article"
              className={`flex h-full items-start gap-2.5 p-2.5! ${
                badge.earned ? "" : "bg-neutral-100!"
              }`}
            >
              <span
                aria-hidden="true"
                className={`inline-flex h-11 w-11 shrink-0 items-center justify-center border-2 text-xs font-bold ${
                  badge.earned
                    ? "border-ink bg-accent text-ink"
                    : "border-neutral-300 bg-surface text-neutral-400"
                }`}
              >
                {badge.icon}
              </span>
              <div className="min-w-0 flex-1">
                <h3
                  className={`text-sm font-semibold ${
                    badge.earned ? "text-foreground" : "text-neutral-600"
                  }`}
                >
                  {badge.name}
                  <span className="sr-only">
                    {badge.earned ? " (earned)" : " (not earned yet)"}
                  </span>
                </h3>
                <p className="text-xs text-neutral-600">{badge.rule}</p>
                <p
                  className={`mt-0.5 text-xs font-bold ${
                    badge.earned ? "text-foreground" : "text-neutral-500"
                  }`}
                >
                  {badge.earned ? "✓ Earned" : badge.progress}
                </p>
              </div>
            </PixelCard>
          </li>
        ))}
      </ul>

      <p className="text-xs text-neutral-500">
        Badges are counted from your latest {basedOn} quiz
        {basedOn === 1 ? "" : "zes"}.
      </p>
    </div>
  );
}
