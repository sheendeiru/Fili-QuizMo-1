"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { DashboardNavItem } from "@/components/dashboard/dashboard-shell";
import { logoutAndRedirect } from "@/lib/auth/logout";

export type StudentHistoryRow = {
  attempt_id: string | null;
  session_id: string | null;
  quiz_title: string | null;
  attempt_number: number | null;
  correct_count: number | null;
  total_questions: number | null;
  answered_count: number | null;
  final_score: string | null;
  percentage: number | null;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
};

type StudentDashboardContentProps = {
  profile: {
    username: string | null;
    email: string | null;
    createdAt: string | null;
  };
  history: StudentHistoryRow[];
};

const navItems: DashboardNavItem[] = [
  { key: "overview", label: "Overview" },
  { key: "history", label: "Quiz History" },
  { key: "profile", label: "Profile" },
];

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeZone: "Asia/Manila",
});

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : dateFormatter.format(date);
}

function formatPercent(value: number | null): string {
  return value === null || !Number.isFinite(value)
    ? "—"
    : `${Math.round(value)}%`;
}

function formatDuration(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value < 0) {
    return "—";
  }

  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-sm text-neutral-500">{hint}</p>
    </article>
  );
}

function HistoryTable({
  rows,
  emptyMessage,
}: {
  rows: StudentHistoryRow[];
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-neutral-200 text-left text-sm">
        <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">
              Quiz
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Attempt
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Score
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Percentage
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Completed
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Duration
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((row) => (
            <tr
              key={`${row.attempt_id ?? row.session_id}-${row.attempt_number ?? 0}`}
              className="hover:bg-neutral-50"
            >
              <td className="px-4 py-3 font-medium text-foreground">
                {row.quiz_title ?? "Untitled quiz"}
              </td>
              <td className="px-4 py-3 text-neutral-600">
                {row.attempt_number ?? "—"}
              </td>
              <td className="px-4 py-3 text-neutral-600">
                {row.correct_count ?? 0}/{row.total_questions ?? 0}
              </td>
              <td className="px-4 py-3 font-semibold text-primary">
                {formatPercent(row.percentage)}
              </td>
              <td className="px-4 py-3 text-neutral-600">
                {formatDate(row.completed_at)}
              </td>
              <td className="px-4 py-3 text-neutral-600">
                {formatDuration(row.duration_seconds)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StudentDashboardContent({
  profile,
  history,
}: StudentDashboardContentProps) {
  const [activeKey, setActiveKey] = useState("overview");
  const router = useRouter();
  const percentages = history
    .map((row) => row.percentage)
    .filter(
      (value): value is number =>
        value !== null && Number.isFinite(value),
    );
  const average =
    percentages.length > 0
      ? percentages.reduce((total, value) => total + value, 0) /
        percentages.length
      : null;
  const best =
    percentages.length > 0 ? Math.max(...percentages) : null;

  return (
    <DashboardShell
      role="Student"
      navItems={navItems}
      activeKey={activeKey}
      onNavigate={setActiveKey}
      onLogout={() => logoutAndRedirect(router)}
    >
      {activeKey === "overview" ? (
        <div className="space-y-6">
          <section>
            <h2 className="text-2xl font-bold text-foreground">
              Welcome back, {profile.username ?? "Student"}!
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Here is a summary of your quiz activity.
            </p>
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Recorded attempts"
              value={String(history.length)}
              hint="Latest 100 attempts"
            />
            <StatCard
              label="Average score"
              value={formatPercent(average)}
              hint="Across all attempts"
            />
            <StatCard
              label="Best score"
              value={formatPercent(best)}
              hint="Your highest percentage"
            />
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-foreground">
                Recent quiz history
              </h3>
              {history.length > 5 ? (
                <button
                  type="button"
                  onClick={() => setActiveKey("history")}
                  className="text-sm font-semibold text-secondary hover:underline focus-visible:outline"
                >
                  View all
                </button>
              ) : null}
            </div>
            <HistoryTable
              rows={history.slice(0, 5)}
              emptyMessage="No quiz results yet. Your completed quizzes will appear here."
            />
          </section>
        </div>
      ) : null}

      {activeKey === "history" ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Quiz History
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Your latest {history.length} recorded attempt
              {history.length === 1 ? "" : "s"}.
            </p>
          </div>
          <HistoryTable
            rows={history}
            emptyMessage="No quiz results yet. Your completed quizzes will appear here."
          />
        </div>
      ) : null}

      {activeKey === "profile" ? (
        <div className="max-w-xl space-y-4">
          <h2 className="text-2xl font-bold text-foreground">Profile</h2>
          <dl className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="flex justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <dt className="text-sm text-neutral-500">Username</dt>
              <dd className="text-sm font-semibold text-foreground">
                {profile.username ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <dt className="text-sm text-neutral-500">Email</dt>
              <dd className="text-sm font-semibold text-foreground">
                {profile.email ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <dt className="text-sm text-neutral-500">Member since</dt>
              <dd className="text-sm font-semibold text-foreground">
                {formatDate(profile.createdAt)}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </DashboardShell>
  );
}
