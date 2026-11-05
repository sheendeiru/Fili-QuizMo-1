"use client";

import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  DashboardShell,
  type DashboardNavItem,
} from "@/components/dashboard/dashboard-shell";
import { PixelLoader } from "@/components/ui/pixel-loader";
import { useNavigation } from "@/components/pixel";
import { Button } from "@/components/ui/button";
import { PixelCard } from "@/components/ui/pixel-primitives";
import { SearchFilter } from "@/components/dashboard/search-filter";
import { ManageAccountsTable } from "@/components/dashboard/manage-accounts";
import { FormField } from "@/components/ui/form-field";
import { defaultSearchQuery } from "@/lib/search/url-state";
import { logoutAndRedirect } from "@/lib/auth/logout";
import type { TeacherDashboardData } from "@/lib/dashboard/data";

const PieChart = dynamic(
  () =>
    import("@/components/dashboard/pie-chart").then(
      (module) => module.PieChart,
    ),
  {
    loading: () => <PixelLoader label="Loading score chart..." />,
  },
);

const navItems: DashboardNavItem[] = [
  { key: "quizzes", label: "View Quizzes" },
  { key: "students", label: "Manage Student Info" },
  { key: "scores", label: "View Scores" },
  { key: "leaderboard", label: "Leaderboard" },
  { key: "settings", label: "Settings" },
];

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeZone: "Asia/Manila",
});

function formatDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

export default function TeacherDashboardContent({
  data,
}: {
  data: TeacherDashboardData;
}) {
  const searchParams = useSearchParams();
  const entity = searchParams.get("entity");
  const urlActiveKey =
    entity === "students" || entity === "student_accounts"
      ? "students"
      : "quizzes";
  // The section the teacher last clicked. It wins over the URL so the sidebar
  // highlight and the content switch together, instantly, on every click.
  const [manualActiveKey, setManualActiveKey] = useState<string | null>(null);
  const activeKey = manualActiveKey ?? urlActiveKey;
  const [logoutError, setLogoutError] = useState("");
  const router = useRouter();
  const { navigate } = useNavigation();
  const pathname = usePathname();

  useEffect(() => {
    // Browser back/forward: fall back to whatever the URL says.
    function clearManualSection() {
      setManualActiveKey(null);
    }

    window.addEventListener("popstate", clearManualSection);
    return () => window.removeEventListener("popstate", clearManualSection);
  }, []);

  function navigateToSection(key: string) {
    // Always select the clicked section first. Before, clicking Students or
    // Quizzes cleared this and fell back to the *old* URL, so the sidebar and
    // content flashed the wrong section until the route finished changing.
    setManualActiveKey(key);

    if (key !== "students" && key !== "quizzes") {
      return;
    }

    const target = key === "students" ? "student_accounts" : "quizzes";
    const params = new URLSearchParams();
    const query = defaultSearchQuery("teacher", target);
    params.set("entity", query.entity);

    // Already on this exact URL: don't stack duplicate history entries.
    if (params.toString() === searchParams.toString()) {
      return;
    }

    navigate(() =>
      router.push(`${pathname}?${params.toString()}`, { scroll: false }),
    );
  }

  async function handleLogout() {
    setLogoutError("");

    try {
      await logoutAndRedirect(router, navigate);
    } catch (error) {
      setLogoutError(
        error instanceof Error ? error.message : "Unable to log out.",
      );
    }
  }

  return (
    <DashboardShell
      role="Teacher"
      navItems={navItems}
      activeKey={activeKey}
      onNavigate={navigateToSection}
      onLogout={handleLogout}
    >
      {logoutError ? (
        <p
          role="alert"
          className="mb-3 flex items-center gap-2 border-2 border-danger-dark bg-danger-surface px-3 py-2 text-sm text-danger-dark"
        >
          Unable to log out: {logoutError}
        </p>
      ) : null}
      {activeKey === "quizzes" && <QuizzesSection data={data} />}
      {activeKey === "students" && <StudentsSection />}
      {activeKey === "scores" && <ScoresSection data={data} />}
      {activeKey === "leaderboard" && <LeaderboardSection data={data} />}
      {activeKey === "settings" && <SettingsSection />}
    </DashboardShell>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-px-muted">{description}</p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <PixelCard as="article">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
    </PixelCard>
  );
}

/** One card style for every chart so the sections look the same. */
function ChartPanel({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: ReactNode;
}) {
  return (
    <PixelCard as="article">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-neutral-500">{caption}</p>
      <div className="mt-3">{children}</div>
    </PixelCard>
  );
}

function QuizzesSection({ data }: { data: TeacherDashboardData }) {
  return (
    <div className="space-y-4">
      <SectionHeading
        title="View Quizzes"
        description="Review your quiz library and overall class performance."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Total Quizzes"
          value={String(data.quizzes.total)}
        />
        <StatCard
          label="Active Students"
          value={String(data.studentCount)}
        />
        <StatCard
          label="Average Score"
          value={`${data.results.average}%`}
        />
      </div>

      <SearchFilter role="teacher" entity="quizzes" />

      <ChartPanel
        title="Student Score Distribution"
        caption="Latest quiz performance across score bands."
      >
        <PieChart distributions={data.distributions} />
      </ChartPanel>
    </div>
  );
}

function StudentsSection() {
  return (
    <div className="space-y-4">
      <SectionHeading
        title="Manage Student Info"
        description="Search students assigned to your classes."
      />

      <ManageAccountsTable actorRole="teacher" accountRole="student" />
    </div>
  );
}

function ScoresSection({ data }: { data: TeacherDashboardData }) {
  return (
    <div className="space-y-4">
      <SectionHeading
        title="Students & Scores"
        description="Search students and review their quiz performances."
      />
      <SearchFilter role="teacher" entity="students" />
      <ChartPanel
        title="Score Distribution"
        caption="Student score distribution per quiz."
      >
        <PieChart distributions={data.distributions} />
      </ChartPanel>
    </div>
  );
}

function ordinal(rank: number): string {
  if (rank % 100 >= 11 && rank % 100 <= 13) return `${rank}th`;
  if (rank % 10 === 1) return `${rank}st`;
  if (rank % 10 === 2) return `${rank}nd`;
  if (rank % 10 === 3) return `${rank}rd`;
  return `${rank}th`;
}

const medalClass: Record<number, string> = {
  1: "bg-accent text-ink",
  2: "bg-neutral-300 text-ink",
  3: "bg-accent-dark text-ink",
};

function RankChip({ rank }: { rank: number }) {
  return (
    <span
      className={`inline-block min-w-12 border-2 border-ink px-2 py-0.5 text-center text-xs font-bold ${
        medalClass[rank] ?? "bg-surface text-ink"
      }`}
    >
      {ordinal(rank)}
    </span>
  );
}

function ScoreBar({ value }: { value: number }) {
  const width = Math.min(100, Math.max(0, value));
  const tone =
    value >= 75 ? "bg-primary" : value >= 50 ? "bg-accent" : "bg-danger";

  return (
    <div className="flex items-center gap-2">
      <div
        aria-hidden="true"
        className="h-3 w-20 shrink-0 border-2 border-ink bg-surface"
      >
        <div className={`h-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
      <span className="font-semibold text-foreground">
        {Math.round(value * 10) / 10}%
      </span>
    </div>
  );
}

function LeaderboardSection({ data }: { data: TeacherDashboardData }) {
  const { overall, byQuiz } = data.leaderboards;
  const boards = [overall, ...byQuiz];
  const [selected, setSelected] = useState(0);
  const board = boards[selected] ?? overall;
  const primaryLabel = board.rankedBy === "best" ? "Best score" : "Average";
  const secondaryLabel = board.rankedBy === "best" ? "Average" : "Best score";

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Leaderboard"
        description="See which students are scoring highest across your quizzes."
      />

      {overall.entries.length === 0 ? (
        <PixelCard>
          <p className="text-sm text-neutral-600">
            No quiz results yet. Student rankings will appear here once
            quizzes are completed.
          </p>
        </PixelCard>
      ) : (
        <>
          <div>
            <label
              htmlFor="leaderboard-quiz"
              className="block text-sm font-medium text-foreground"
            >
              Show ranking for
            </label>
            <select
              id="leaderboard-quiz"
              value={selected}
              onChange={(event) => setSelected(Number(event.target.value))}
              className="mt-1 h-10 w-full max-w-xs px-3 text-sm"
            >
              {boards.map((option, index) => (
                <option key={option.quiz ?? "overall"} value={index}>
                  {option.quiz ?? "Overall (all quizzes)"}
                </option>
              ))}
            </select>
          </div>

          <ChartPanel
            title={board.quiz ?? "Overall ranking"}
            caption={
              board.rankedBy === "best"
                ? "Ranked by best score on this quiz. Top 10 students."
                : "Ranked by average score across all quizzes. Top 10 students."
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <caption className="sr-only">
                  {board.quiz ?? "Overall"} leaderboard
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="py-2 pr-3">Rank</th>
                    <th scope="col" className="py-2 pr-3">Student</th>
                    <th scope="col" className="py-2 pr-3">{primaryLabel}</th>
                    <th scope="col" className="py-2 pr-3">{secondaryLabel}</th>
                    <th scope="col" className="py-2 pr-3">Attempts</th>
                    <th scope="col" className="py-2">Last active</th>
                  </tr>
                </thead>
                <tbody>
                  {board.entries.map((entry) => (
                    <tr key={entry.student}>
                      <td className="py-2 pr-3">
                        <RankChip rank={entry.rank} />
                      </td>
                      <td className="py-2 pr-3 font-semibold text-foreground">
                        {entry.student}
                      </td>
                      <td className="py-2 pr-3">
                        <ScoreBar
                          value={
                            board.rankedBy === "best"
                              ? entry.best
                              : entry.average
                          }
                        />
                      </td>
                      <td className="py-2 pr-3">
                        {Math.round(
                          (board.rankedBy === "best"
                            ? entry.average
                            : entry.best) * 10,
                        ) / 10}
                        %
                      </td>
                      <td className="py-2 pr-3">{entry.attempts}</td>
                      <td className="py-2">
                        {formatDate(entry.lastCompletedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartPanel>
        </>
      )}
    </div>
  );
}

function SettingsSection() {
  const [saveNotice, setSaveNotice] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveNotice(
      "Settings are not connected to profile storage yet; no changes were saved.",
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Settings"
        description="Update your teacher profile and notification preferences."
      />

      <PixelCard className="max-w-2xl">
        <form className="space-y-3" onSubmit={handleSubmit}>
          <FormField
            label="Display name"
            id="teacher-display-name"
            name="displayName"
            type="text"
            defaultValue="Teacher Account"
            required
          />
          <FormField
            label="Email address"
            id="teacher-settings-email"
            name="email"
            type="email"
            defaultValue="teacher@example.com"
            required
          />
          <label className="flex items-center gap-3 text-sm text-neutral-600">
            <input
              type="checkbox"
              name="notifications"
              defaultChecked
              className="h-4 w-4 rounded border-neutral-300 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            />
            Email me when students submit quiz scores
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit">Save Changes</Button>
            {saveNotice ? (
              <span role="status" className="text-sm text-px-gold-text">
                {saveNotice}
              </span>
            ) : null}
          </div>
        </form>
      </PixelCard>
    </div>
  );
}
