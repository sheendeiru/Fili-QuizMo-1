import { PixelCard } from "@/components/ui/pixel-primitives";
import type { DashboardScore } from "@/lib/dashboard/data";
import { formatRawScore } from "@/lib/dashboard/raw-score";

/** part / whole as a 0-100 number; 0 when there is nothing to divide by. */
export function percentOf(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

/**
 * Horizontal bar chart built from counts the dashboard already loads.
 * Pixel-style track (border-2 border-ink) so it matches the existing cards.
 */
export function BarChartCard({
  title,
  description,
  total,
  items,
}: {
  title: string;
  description: string;
  total: number;
  items: { label: string; value: number; color: string }[];
}) {
  return (
    <PixelCard as="article" className="h-full">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-neutral-500">{description}</p>

      {total > 0 && items.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {items.map((item) => {
            const percent = Math.round((item.value / total) * 100);

            return (
              <li key={item.label}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-semibold text-foreground">
                    {item.label}
                  </span>
                  <span className="shrink-0 text-neutral-500">
                    <span className="font-semibold text-foreground">
                      {item.value}
                    </span>{" "}
                    of {total} ({percent}%)
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="mt-1 h-4 border-2 border-ink bg-px-cream"
                >
                  <div
                    className={`h-full ${item.color}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-neutral-500">Nothing to show yet.</p>
      )}
    </PixelCard>
  );
}

/** Stat card with a 0-100 meter, for percentages such as the average score. */
export function MeterCard({
  label,
  percent,
}: {
  label: string;
  percent: number;
}) {
  const value = Number.isFinite(percent)
    ? Math.min(Math.max(percent, 0), 100)
    : 0;
  const shown = Math.round(value * 10) / 10;

  return (
    <PixelCard as="article">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-foreground">{shown}%</p>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={shown}
        className="mt-2 h-3 border-2 border-ink bg-px-cream"
      >
        <div className="h-full bg-primary" style={{ width: `${value}%` }} />
      </div>
    </PixelCard>
  );
}

function scoreTone(score: number): string {
  if (score >= 75) return "bg-success";
  if (score >= 50) return "bg-px-gold";
  return "bg-danger-dark";
}

/**
 * The latest completed attempts, one score bar per attempt. The label is the
 * raw score (e.g. 8/10); the bar is still drawn from the percentage. If an
 * attempt has no raw counts, the label falls back to the percentage.
 */
export function RecentScoresCard({
  title,
  description,
  scores,
}: {
  title: string;
  description: string;
  scores: readonly DashboardScore[];
}) {
  return (
    <PixelCard as="article" className="h-full">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-neutral-500">{description}</p>

      {scores.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {scores.map((entry) => {
            const percent = Math.round(Math.min(100, Math.max(0, entry.score)));
            const raw = formatRawScore(entry.correct, entry.total);

            return (
              <li key={entry.id}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-foreground">
                    <span className="font-semibold">{entry.student}</span>
                    <span className="text-neutral-500"> · {entry.quizTitle}</span>
                  </span>
                  <span
                    className="shrink-0 font-semibold text-foreground"
                    title={`${percent}%`}
                  >
                    {raw ?? `${percent}%`}
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="mt-1 h-3 border-2 border-ink bg-px-cream"
                >
                  <div
                    className={`h-full ${scoreTone(entry.score)}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-neutral-500">Nothing to show yet.</p>
      )}
    </PixelCard>
  );
}
