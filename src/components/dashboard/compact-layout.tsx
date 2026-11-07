"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { PixelCard } from "@/components/ui/pixel-primitives";

/**
 * Compact building blocks shared by the admin, teacher and student dashboards.
 * Put this file at components/dashboard/compact-layout.tsx.
 */

export function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-bold text-foreground sm:text-xl">{title}</h2>
      <p className="mt-0.5 text-xs text-px-muted sm:text-sm">{description}</p>
    </div>
  );
}

/** Small stat tile. Two fit side by side even on a narrow phone. */
export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <PixelCard as="article" className="min-w-0 p-2.5! sm:p-3!">
      <p className="truncate text-xs text-neutral-500 sm:text-sm">{label}</p>
      <p className="mt-0.5 text-lg font-bold leading-tight text-foreground sm:text-xl">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 truncate text-xs text-neutral-500">{hint}</p>
      ) : null}
    </PixelCard>
  );
}

const STAT_COLUMNS = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
} as const;

/**
 * Two columns on phones, `columns` from the sm breakpoint up. A lone last
 * tile on an odd row stretches across the phone grid so there is no gap.
 */
export function StatGrid({
  columns = 4,
  children,
}: {
  columns?: keyof typeof STAT_COLUMNS;
  children: ReactNode;
}) {
  return (
    <div
      className={`grid grid-cols-2 gap-2 sm:gap-3 [&>:last-child:nth-child(odd)]:col-span-2 sm:[&>:last-child:nth-child(odd)]:col-span-1 ${STAT_COLUMNS[columns]}`}
    >
      {children}
    </div>
  );
}

export type ChartTab = {
  key: string;
  label: string;
  content: ReactNode;
  /** Span both columns from the md breakpoint up. */
  wide?: boolean;
};

/**
 * Below md: one chart at a time, switched with a row of tabs, so a phone
 * does not have to scroll past every chart. From md up the tabs disappear
 * and every chart shows in a 2-column grid.
 */
export function ChartTabs({
  tabs,
  label,
}: {
  tabs: ChartTab[];
  label: string;
}) {
  const [activeKey, setActiveKey] = useState(tabs[0]?.key ?? "");

  if (tabs.length === 0) {
    return null;
  }

  // Falls back to the first tab if the active one stops existing.
  const active = tabs.some((tab) => tab.key === activeKey)
    ? activeKey
    : tabs[0].key;

  return (
    <div>
      <div
        role="group"
        aria-label={label}
        className="mb-1 flex gap-1.5 overflow-x-auto p-1 pb-2 md:hidden"
      >
        {tabs.map((tab) => {
          const selected = tab.key === active;

          return (
            <button
              key={tab.key}
              type="button"
              aria-pressed={selected}
              onClick={() => setActiveKey(tab.key)}
              className={`shrink-0 whitespace-nowrap border-2 border-ink px-3 py-1.5 text-xs font-bold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                selected
                  ? "bg-primary shadow-[2px_2px_0_var(--color-ink)]"
                  : "bg-surface"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-2 sm:gap-3 md:grid-cols-2">
        {tabs.map((tab) => (
          <div
            key={tab.key}
            className={`md:block md:[&>*]:h-full ${
              tab.key === active ? "block" : "hidden"
            } ${tab.wide ? "md:col-span-2" : ""}`}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
}
