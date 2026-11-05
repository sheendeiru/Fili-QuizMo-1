// components/dashboard/dashboard-skeleton.tsx
// Loading placeholder for the dashboards: same frame and card shapes as the real page,
// with a stepped two-frame blink (the `pixel-progress-segment` animation from globals.css).

import type { ReactNode } from "react";

type DashboardSkeletonProps = {
  /** Announced to screen readers, e.g. "Loading student dashboard...". */
  label: string;
  /** Match the layout of the dashboard being loaded. */
  variant?: "student" | "teacher" | "generic";
  /** Include the header bar and page container so nothing jumps when the real page appears. */
  framed?: boolean;
};

/** One placeholder bar. The blink is staggered for the first few siblings inside a card. */
function Bar({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pixel-progress-segment bg-neutral-300 ${className}`}
    />
  );
}

/** Same look as the real cards: cream fill, ink border, hard pixel shadow. */
function Panel({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      aria-hidden="true"
      className={`border-2 border-ink bg-surface p-4 shadow-[3px_3px_0_var(--color-ink)] ${className}`}
    >
      {children}
    </div>
  );
}

function HeadingPlaceholder() {
  return (
    <div aria-hidden="true" className="space-y-2">
      <Bar className="h-6 w-56 max-w-full" />
      <Bar className="h-4 w-72 max-w-full" />
    </div>
  );
}

function StatPlaceholder() {
  return (
    <Panel className="space-y-2">
      <Bar className="h-3 w-24" />
      <Bar className="h-6 w-16" />
      <Bar className="h-3 w-32 max-w-full" />
    </Panel>
  );
}

const columnHeights = [
  "h-1/3",
  "h-1/2",
  "h-2/5",
  "h-3/4",
  "h-3/5",
  "h-5/6",
  "h-2/3",
  "h-4/5",
];

/** Column chart shape, so people can tell a chart is coming. */
function ChartPlaceholder({ className = "h-44" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`flex items-end gap-2 border-b-2 border-ink/30 px-1 ${className}`}
    >
      {columnHeights.map((height) => (
        <Bar key={height} className={`flex-1 ${height}`} />
      ))}
    </div>
  );
}

const rowWidths = ["w-4/5", "w-3/5", "w-2/3", "w-2/5"];

/** Horizontal bar rows, like "Average by quiz". */
function RowsPlaceholder() {
  return (
    <Panel className="space-y-3">
      <Bar className="h-4 w-32" />
      {rowWidths.map((width) => (
        <div key={width} className="space-y-1">
          <Bar className="h-3 w-40 max-w-full" />
          <Bar className={`h-4 ${width}`} />
        </div>
      ))}
    </Panel>
  );
}

function TablePlaceholder() {
  return (
    <Panel className="space-y-3">
      <Bar className="h-4 w-full" />
      {Array.from({ length: 5 }, (_, index) => (
        <Bar key={index} className="h-5 w-full" />
      ))}
    </Panel>
  );
}

function StudentLayout() {
  return (
    <>
      <HeadingPlaceholder />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <StatPlaceholder key={index} />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <Panel className="space-y-3 lg:col-span-2">
          <Bar className="h-4 w-32" />
          <ChartPlaceholder />
        </Panel>
        <Panel className="space-y-3">
          <Bar className="h-4 w-28" />
          <Bar className="h-6 w-24" />
          <Bar className="h-6 w-full" />
          <Bar className="h-3 w-full" />
          <Bar className="h-3 w-3/4" />
        </Panel>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <RowsPlaceholder />
        <RowsPlaceholder />
      </div>
      <TablePlaceholder />
    </>
  );
}

function TeacherLayout() {
  return (
    <>
      <HeadingPlaceholder />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <StatPlaceholder key={index} />
        ))}
      </div>
      <Panel className="space-y-3">
        <Bar className="h-4 w-32" />
        <Bar className="h-10 w-full" />
        <div className="flex flex-wrap gap-3">
          <Bar className="h-9 w-28" />
          <Bar className="h-9 w-28" />
          <Bar className="ml-auto h-9 w-36" />
        </div>
      </Panel>
      <Panel className="space-y-3">
        <Bar className="h-4 w-40" />
        <ChartPlaceholder />
      </Panel>
    </>
  );
}

function GenericLayout() {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <StatPlaceholder key={index} />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel className="space-y-3">
          <Bar className="h-4 w-32" />
          <ChartPlaceholder className="h-56" />
        </Panel>
        <Panel className="space-y-3">
          <Bar className="h-4 w-32" />
          <ChartPlaceholder className="h-56" />
        </Panel>
      </div>
    </>
  );
}

export function DashboardSkeleton({
  label,
  variant = "generic",
  framed = true,
}: DashboardSkeletonProps) {
  const body = (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="space-y-4"
    >
      <span className="sr-only">{label}</span>
      {variant === "student" ? <StudentLayout /> : null}
      {variant === "teacher" ? <TeacherLayout /> : null}
      {variant === "generic" ? <GenericLayout /> : null}
    </div>
  );

  if (!framed) {
    return body;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Same height and styling as the real header, so the page doesn't shift on load. */}
      <div
        aria-hidden="true"
        className="sticky top-0 z-20 flex h-14 items-center justify-between border-b-2 border-ink bg-surface px-3 shadow-[0_3px_0_var(--color-ink)] sm:px-4"
      >
        <div className="flex items-center gap-3">
          <Bar className="h-9 w-9" />
          <Bar className="h-5 w-40" />
        </div>
        <Bar className="h-9 w-9" />
      </div>
      <main className="mx-auto w-full max-w-5xl p-3 sm:p-4">{body}</main>
    </div>
  );
}
