// components/dashboard/student-charts.tsx
// Dependency-free pixel-style charts for the student dashboard (SVG + Tailwind tokens only).

import type { ReactNode } from "react";
import { PixelCard } from "@/components/ui/pixel-primitives";
import type { StudentAnalytics } from "@/lib/dashboard/student-analytics";

type Tone = "good" | "ok" | "low";

const shortDate = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  timeZone: "Asia/Manila",
});

function formatShortDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : shortDate.format(date);
}

const clamp = (value: number) => Math.min(100, Math.max(0, value));

function toneFor(percentage: number): Tone {
  if (percentage >= 75) return "good";
  if (percentage >= 50) return "ok";
  return "low";
}

const toneFill: Record<Tone, string> = {
  good: "fill-primary",
  ok: "fill-accent",
  low: "fill-danger",
};

const toneBg: Record<Tone, string> = {
  good: "bg-primary",
  ok: "bg-accent",
  low: "bg-danger",
};

const chipClass: Record<Tone, string> = {
  good: "border-ink bg-primary text-ink",
  ok: "border-ink bg-accent text-ink",
  low: "border-danger-dark bg-danger-surface text-danger-dark",
};

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

export function ChartCard({
  title,
  caption,
  className = "",
  children,
}: {
  title: string;
  caption: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <PixelCard as="article" className={`p-2.5! sm:p-3! ${className}`}>
      <h3 className="text-sm font-semibold text-foreground sm:text-base">
        {title}
      </h3>
      <p className="mt-0.5 text-xs text-neutral-500 sm:text-sm">{caption}</p>
      <div className="mt-2">{children}</div>
    </PixelCard>
  );
}

/** Colour-coded percentage for table cells. Colour is never the only signal: the number is always shown. */
export function PercentChip({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value)) {
    return <>—</>;
  }

  return (
    <span
      className={`inline-block border-2 px-2 py-0.5 text-xs font-bold ${chipClass[toneFor(value)]}`}
    >
      {Math.round(value)}%
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Score trend                                                      */
/* ------------------------------------------------------------------ */

export function ScoreTrendChart({
  points,
}: {
  points: StudentAnalytics["trend"];
}) {
  const width = 600;
  const height = 230;
  const left = 40;
  const right = 16;
  const top = 16;
  const bottom = 34;
  const plotHeight = height - top - bottom;
  const innerLeft = left + 14;
  const innerRight = width - right - 14;
  const count = points.length;

  const x = (index: number) =>
    count === 1
      ? (innerLeft + innerRight) / 2
      : innerLeft + ((innerRight - innerLeft) * index) / (count - 1);
  const y = (percentage: number) =>
    top + plotHeight - (clamp(percentage) / 100) * plotHeight;

  const first = points[0];
  const last = points[count - 1];
  const label =
    count === 1
      ? `Score trend: one completed quiz, ${Math.round(last.percentage)} percent.`
      : `Score trend over your last ${count} quizzes: from ${Math.round(first.percentage)} percent to ${Math.round(last.percentage)} percent.`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className="h-auto max-h-56 w-full"
    >
      {[0, 25, 50, 75, 100].map((tick) => (
        <g key={tick}>
          <line
            x1={left}
            x2={width - right}
            y1={y(tick)}
            y2={y(tick)}
            className="stroke-ink/15"
            strokeWidth={2}
            shapeRendering="crispEdges"
          />
          <text
            x={left - 8}
            y={y(tick) + 4}
            textAnchor="end"
            className="fill-ink text-[11px]"
          >
            {tick}%
          </text>
        </g>
      ))}

      {count > 1 ? (
        <polyline
          points={points
            .map((point, index) => `${x(index)},${y(point.percentage)}`)
            .join(" ")}
          fill="none"
          className="stroke-ink"
          strokeWidth={3}
          strokeLinejoin="miter"
          shapeRendering="crispEdges"
        />
      ) : null}

      {points.map((point, index) => (
        <g key={`${point.date}-${index}`}>
          <rect
            x={x(index) - 6}
            y={y(point.percentage) - 6}
            width={12}
            height={12}
            strokeWidth={2}
            shapeRendering="crispEdges"
            className={`stroke-ink ${toneFill[toneFor(point.percentage)]}`}
          >
            <title>{`${point.quiz} · ${formatShortDate(point.date)} · ${Math.round(point.percentage)}%`}</title>
          </rect>
          {count <= 5 || index % 2 === 0 || index === count - 1 ? (
            <text
              x={x(index)}
              y={height - 12}
              textAnchor="middle"
              className="fill-ink text-[11px]"
            >
              {formatShortDate(point.date)}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Latest quiz: correct / wrong / skipped                           */
/* ------------------------------------------------------------------ */

export function LatestBreakdown({
  data,
}: {
  data: NonNullable<StudentAnalytics["latestBreakdown"]>;
}) {
  const segments = [
    { label: "Correct", value: data.correct, bg: "bg-primary" },
    { label: "Wrong", value: data.wrong, bg: "bg-danger" },
    { label: "Skipped", value: data.skipped, bg: "bg-neutral-300" },
  ];

  return (
    <div>
      <p className="truncate text-sm font-semibold text-foreground" title={data.quiz}>
        {data.quiz}
      </p>
      <p className="mt-1 text-xl font-bold text-foreground">
        {data.correct}/{data.total}{" "}
        <span className="text-sm font-semibold text-neutral-500">correct</span>
      </p>

      <div
        className="mt-2 flex h-5 w-full border-2 border-ink bg-surface"
        role="img"
        aria-label={`${data.correct} correct, ${data.wrong} wrong, ${data.skipped} skipped out of ${data.total} questions`}
      >
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <div
              key={segment.label}
              className={`${segment.bg} border-r-2 border-ink last:border-r-0`}
              style={{ flexGrow: segment.value, flexBasis: 0 }}
            />
          ))}
      </div>

      <ul className="mt-2 space-y-0.5 text-sm">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className={`h-3 w-3 border-2 border-ink ${segment.bg}`} />
              {segment.label}
            </span>
            <span className="font-semibold text-foreground">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Average by quiz                                                  */
/* ------------------------------------------------------------------ */

export function AverageByQuiz({
  rows,
}: {
  rows: StudentAnalytics["byQuiz"];
}) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.quiz}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-semibold text-foreground" title={row.quiz}>
              {row.quiz}
            </span>
            <span className="shrink-0 text-neutral-500">
              {Math.round(row.average)}% · {row.attempts}{" "}
              {row.attempts === 1 ? "attempt" : "attempts"}
            </span>
          </div>
          <div
            className="mt-1 h-3 border-2 border-ink bg-surface sm:h-4"
            role="img"
            aria-label={`${row.quiz}: average ${Math.round(row.average)} percent`}
          >
            <div
              className={`h-full ${toneBg[toneFor(row.average)]}`}
              style={{ width: `${clamp(row.average)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Score bands                                                      */
/* ------------------------------------------------------------------ */

const bandFill = ["fill-primary", "fill-primary-dark", "fill-accent", "fill-danger"];

export function ScoreBands({ bands }: { bands: StudentAnalytics["bands"] }) {
  const width = 320;
  const height = 170;
  const barWidth = 56;
  const gap = 20;
  const baseline = 130;
  const maxBarHeight = 100;
  const startX = (width - (bands.length * barWidth + (bands.length - 1) * gap)) / 2;
  const maxCount = Math.max(1, ...bands.map((band) => band.count));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Quizzes per score band: ${bands
        .map((band) => `${band.label}, ${band.count}`)
        .join("; ")}`}
      className="h-auto max-h-44 w-full"
    >
      <line
        x1={8}
        x2={width - 8}
        y1={baseline}
        y2={baseline}
        className="stroke-ink"
        strokeWidth={2}
        shapeRendering="crispEdges"
      />
      {bands.map((band, index) => {
        const barHeight = (band.count / maxCount) * maxBarHeight;
        const barX = startX + index * (barWidth + gap);

        return (
          <g key={band.label}>
            {band.count > 0 ? (
              <rect
                x={barX}
                y={baseline - barHeight}
                width={barWidth}
                height={barHeight}
                strokeWidth={2}
                shapeRendering="crispEdges"
                className={`stroke-ink ${bandFill[index] ?? "fill-primary"}`}
              />
            ) : null}
            <text
              x={barX + barWidth / 2}
              y={baseline - barHeight - 8}
              textAnchor="middle"
              className="fill-ink text-[12px] font-bold"
            >
              {band.count}
            </text>
            <text
              x={barX + barWidth / 2}
              y={baseline + 18}
              textAnchor="middle"
              className="fill-ink text-[10px]"
            >
              {band.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Retake progress                                                  */
/* ------------------------------------------------------------------ */

export function RetakeProgress({
  rows,
  raw,
}: {
  rows: StudentAnalytics["retakes"];
  /** Raw scores by quiz (e.g. "4/10" -> "8/10"). Quizzes without one show percentages. */
  raw?: ReadonlyMap<string, { first: string; latest: string }>;
}) {
  return (
    <ul className="divide-y-2 divide-ink/15">
      {rows.map((row) => {
        const change = Math.round(row.change);
        const chip =
          change > 0
            ? "border-ink bg-primary text-ink"
            : change < 0
              ? "border-danger-dark bg-danger-surface text-danger-dark"
              : "border-ink bg-surface text-ink";

        return (
          <li
            key={row.quiz}
            className="flex items-center justify-between gap-3 py-1.5 text-sm first:pt-0 last:pb-0"
          >
            <span className="truncate font-semibold text-foreground" title={row.quiz}>
              {row.quiz}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span
                className="text-neutral-500"
                title={`${Math.round(row.first)}% → ${Math.round(row.latest)}%`}
              >
                {raw?.get(row.quiz)
                  ? `${raw.get(row.quiz)?.first} → ${raw.get(row.quiz)?.latest}`
                  : `${Math.round(row.first)}% → ${Math.round(row.latest)}%`}
              </span>
              <span className={`border-2 px-2 py-0.5 text-xs font-bold ${chip}`}>
                {change > 0 ? "+" : ""}
                {change} pts
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
