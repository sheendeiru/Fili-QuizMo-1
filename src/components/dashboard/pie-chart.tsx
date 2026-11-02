"use client";

import { useState } from "react";
import type { ScoreDistribution } from "@/lib/dashboard/score-bands";

type PieChartProps = {
  distributions: readonly ScoreDistribution[];
};

export function PieChart({ distributions }: PieChartProps) {
  const [selectedQuiz, setSelectedQuiz] = useState(0);

  if (distributions.length === 0) {
    return (
      <p className="rounded-lg bg-neutral-100 p-6 text-sm text-neutral-600">
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

  return (
    <div className="space-y-6">
      <div>
        <label
          htmlFor="score-quiz-select"
          className="block text-sm font-medium text-neutral-600"
        >
          Quiz
        </label>
        <select
          id="score-quiz-select"
          value={selectedIndex}
          onChange={(event) => setSelectedQuiz(Number(event.target.value))}
          className="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          {distributions.map((item, index) => (
            <option key={item.quiz} value={index}>
              {item.quiz}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-around">
        <div className="relative h-48 w-48 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
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

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-foreground">
              {distribution.average}%
            </span>
            <span className="text-xs text-neutral-500">Average</span>
          </div>
        </div>

        <ul className="space-y-3">
          {distribution.bands.map((item) => (
            <li key={item.key} className="flex items-center gap-3 text-sm">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-neutral-600">{item.label}</span>
              <span className="ml-auto font-semibold text-foreground">
                {item.value}%
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-neutral-500">
        Based on {distribution.sampleSize}{" "}
        {distribution.sampleSize === 1 ? "completed attempt" : "completed attempts"}.
      </p>
    </div>
  );
}
