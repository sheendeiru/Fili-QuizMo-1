"use client";

import { useId, useState } from "react";
import type { ScoreDistribution } from "@/lib/dashboard/score-bands";

type PieChartProps = {
  distributions: readonly ScoreDistribution[];
};

export function PieChart({ distributions }: PieChartProps) {
  const [selectedQuiz, setSelectedQuiz] = useState(0);
  const selectId = useId();

  if (distributions.length === 0) {
    return (
      <p className="border-2 border-ink bg-neutral-100 p-3 text-sm text-neutral-700 sm:p-4">
        Score distributions will appear after students complete a quiz.
      </p>
    );
  }

  const selectedIndex = Math.min(selectedQuiz, distributions.length - 1);
  const distribution = distributions[selectedIndex];
  const bands = distribution.bands.map((item, index) => ({
    item,
    offset: distribution.bands
      .slice(0, index)
      .reduce((total, band) => total + band.value, 0),
  }));
  const attempts = distribution.sampleSize;

  return (
    <div className="space-y-2">
      <div>
        <label htmlFor={selectId} className="sr-only">
          Quiz
        </label>
        <select
          id={selectId}
          value={selectedIndex}
          onChange={(event) => setSelectedQuiz(Number(event.target.value))}
          className="pixel-input h-9 w-full px-3 text-sm font-medium"
        >
          {distributions.map((item, index) => (
            <option key={`${item.quiz}-${index}`} value={index}>
              {item.quiz}
            </option>
          ))}
        </select>
      </div>

      {/* Donut and legend side by side, on phones too. */}
      <div className="flex items-center gap-3">
        <div className="relative h-24 w-24 shrink-0 sm:h-28 sm:w-28">
          <svg
            viewBox="0 0 100 100"
            className="h-full w-full -rotate-90"
            role="img"
            aria-label={`Score distribution for ${distribution.quiz}, average ${distribution.average}%`}
          >
            {bands.map(({ item, offset }) => {
              return (
                <circle
                  key={item.key}
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={item.color}
                  strokeWidth="20"
                  pathLength="100"
                  strokeDasharray={`${item.value} ${100 - item.value}`}
                  strokeDashoffset={-offset}
                  style={{
                    transition:
                      "stroke-dasharray 1s ease-out, stroke-dashoffset 1s ease-out",
                  }}
                />
              );
            })}
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center leading-tight">
            <span className="text-lg font-bold text-foreground sm:text-xl">
              {distribution.average}%
            </span>
            <span className="text-xs font-medium text-neutral-700">
              Average
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <ul className="space-y-1">
            {distribution.bands.map((item) => (
              <li key={item.key} className="flex items-center gap-2 text-sm">
                <span
                  aria-hidden="true"
                  className="h-3 w-3 shrink-0 border border-ink"
                  style={{ backgroundColor: item.color }}
                />
                <span className="min-w-0 text-neutral-700">{item.label}</span>
                <span className="ml-auto pl-2 font-semibold text-foreground">
                  {item.value}%
                </span>
              </li>
            ))}
          </ul>
          {/* The count sits under the legend instead of taking a row of its own. */}
          <p className="mt-1.5 border-t border-ink/30 pt-1 text-sm text-foreground">
            <strong>Based on {attempts}</strong>{" "}
            {attempts === 1 ? "completed attempt" : "completed attempts"}
          </p>
        </div>
      </div>
    </div>
  );
}
