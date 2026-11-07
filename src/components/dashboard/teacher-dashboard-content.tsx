"use client";

import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { ReactNode } from "react";
import {
  DashboardShell,
  type DashboardNavItem,
} from "@/components/dashboard/dashboard-shell";
import { PixelLoader } from "@/components/ui/pixel-loader";
import { useNavigation } from "@/components/pixel";
import { PixelCard } from "@/components/ui/pixel-primitives";
import {
  ChartTabs,
  SectionHeading,
  StatCard,
  StatGrid,
} from "@/components/dashboard/compact-layout";
import { SearchFilter } from "@/components/dashboard/search-filter";
import { ManageQuizzesTable } from "@/components/dashboard/manage-quizzes";
import {
  BarChartCard,
  MeterCard,
  RecentScoresCard,
} from "@/components/dashboard/dashboard-charts";
import { ManageAccountsTable } from "@/components/dashboard/manage-accounts";
import { ProfileCard } from "@/components/dashboard/profile-card";
import { SettingsPasswordForm } from "@/components/dashboard/settings-password-form";
import { useResetRouteState } from "@/lib/dashboard/route-reset";
import { logoutAndRedirect } from "@/lib/auth/logout";
import { useRealtimeRefresh } from "@/lib/realtime/use-realtime-refresh";
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
];

// Tables the teacher dashboard summarises. Only rows this teacher is allowed
// to read are streamed (row level security).
const LIVE_TABLES = [
  "quiz_sessions",
  "students",
  "quiz_results",
  "account_profiles",
] as const;

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeZone: "Asia/Manila",
});

function formatDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

const BASE_PATH = "/teacher-dashboard";

// One route per sidebar button. `entity` is still sent as a query param
// because the search, table and export components read it from the URL.
// "scores" is the quiz roster with scores; "students" is the account list.
const SECTION_ROUTES = {
  quizzes: { slug: "quizzes", entity: "quizzes" },
  students: { slug: "students", entity: "student_accounts" },
  scores: { slug: "scores", entity: "students" },
  leaderboard: { slug: "leaderboard", entity: null },
  settings: { slug: "settings", entity: null },
} as const;

type SectionKey = keyof typeof SECTION_ROUTES;

function sectionHref(key: SectionKey): string {
  const route = SECTION_ROUTES[key];

  return `${BASE_PATH}/${route.slug}${route.entity ? `?entity=${route.entity}` : ""}`;
}

function isSectionKey(key: string): key is SectionKey {
  return key in SECTION_ROUTES;
}

/** /teacher-dashboard/scores -> "scores". Old ?entity= links still work. */
function sectionFromUrl(pathname: string, entity: string | null): SectionKey {
  const segment = pathname.startsWith(BASE_PATH)
    ? pathname.slice(BASE_PATH.length).split("/").filter(Boolean)[0]
    : undefined;

  const match = (Object.keys(SECTION_ROUTES) as SectionKey[]).find(
    (key) => SECTION_ROUTES[key].slug === segment,
  );
  if (match) return match;

  if (entity === "student_accounts") return "students";
  if (entity === "students") return "scores";
  return "quizzes";
}

export default function TeacherDashboardContent({
  data,
}: {
  data: TeacherDashboardData;
}) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const activeKey = sectionFromUrl(pathname, searchParams.get("entity"));
  const [logoutError, setLogoutError] = useState("");
  const router = useRouter();
  const { navigate } = useNavigation();

  useResetRouteState("teacher-dashboard", sectionHref(activeKey));
  useRealtimeRefresh(LIVE_TABLES);

  function navigateToSection(key: string) {
    if (!isSectionKey(key)) return;

    const target = sectionHref(key);
    const currentSearch = searchParams.toString();
    if (target === `${pathname}${currentSearch ? `?${currentSearch}` : ""}`) {
      return;
    }

    navigate(() => router.push(target, { scroll: false }));
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
    <PixelCard as="article" className="p-2.5! sm:p-3!">
      <h3 className="text-sm font-semibold text-foreground sm:text-base">
        {title}
      </h3>
      <p className="mt-0.5 text-xs text-neutral-500 sm:text-sm">{caption}</p>
      <div className="mt-2">{children}</div>
    </PixelCard>
  );
}

function QuizzesSection({ data }: { data: TeacherDashboardData }) {
  return (
    <div className="space-y-2 sm:space-y-3">
      <SectionHeading
        title="View Quizzes"
        description="Review your quiz library and overall class performance."
      />

      <StatGrid columns={3}>
        <StatCard label="Total Quizzes" value={String(data.quizzes.total)} />
        <StatCard label="Active Students" value={String(data.studentCount)} />
        <StatCard label="Average Score" value={`${data.results.average}%`} />
      </StatGrid>

      {/* Phones: one chart at a time behind tabs. md and up: 2-column grid. */}
      <ChartTabs
        label="Quiz charts"
        tabs={[
          {
            key: "status",
            label: "Quiz Status",
            content: (
              <BarChartCard
                title="Quiz Status"
                description="How your quizzes are split by status."
                total={data.quizzes.total}
                items={[
                  {
                    label: "Ready",
                    value: data.quizzes.ready,
                    color: "bg-success",
                  },
                  {
                    label: "Drafts",
                    value: data.quizzes.draft,
                    color: "bg-px-gold",
                  },
                  {
                    label: "Failed",
                    value: data.quizzes.failed,
                    color: "bg-danger-dark",
                  },
                ]}
              />
            ),
          },
          {
            key: "recent",
            label: "Recent Scores",
            content: (
              <RecentScoresCard
                title="Recent Scores"
                description="The latest completed attempts on your quizzes."
                scores={data.recentScores}
              />
            ),
          },
          {
            key: "distribution",
            label: "Score Distribution",
            wide: true,
            content: (
              <ChartPanel
                title="Student Score Distribution"
                caption="Latest quiz performance across score bands."
              >
                <PieChart distributions={data.distributions} />
              </ChartPanel>
            ),
          },
        ]}
      />

      <ManageQuizzesTable actorRole="teacher" />
    </div>
  );
}

function StudentsSection() {
  return (
    <div className="space-y-2 sm:space-y-3">
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
    <div className="space-y-2 sm:space-y-3">
      <SectionHeading
        title="Students & Scores"
        description="Search students and review their quiz performances."
      />
      <div className="grid gap-2 sm:gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:items-start">
        <MeterCard label="Average Score" percent={data.results.average} />
        <ChartPanel
          title="Score Distribution"
          caption="Student score distribution per quiz."
        >
          <PieChart distributions={data.distributions} />
        </ChartPanel>
      </div>
      <SearchFilter role="teacher" entity="students" />
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
      className={`inline-block min-w-10 border-2 sm:min-w-12 border-ink px-2 py-0.5 text-center text-xs font-bold ${
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
        className="h-2.5 w-14 shrink-0 border-2 border-ink bg-surface sm:h-3 sm:w-20"
      >
        <div className={`h-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
      <span className="font-semibold text-foreground">
        {Math.round(value * 10) / 10}%
      </span>
    </div>
  );
}

// Leaderboard table: tight cells on phones, with the extra columns tucked
// away until there is room (secondary score + attempts from sm, date from md).
const LB_CELL = "py-1.5 pr-2 sm:py-2 sm:pr-3";
const LB_HIDE_SM = "hidden sm:table-cell";
const LB_HIDE_MD = "hidden md:table-cell";

function LeaderboardSection({ data }: { data: TeacherDashboardData }) {
  const { overall, byQuiz } = data.leaderboards;
  const boards = [overall, ...byQuiz];
  const [selected, setSelected] = useState(0);
  const board = boards[selected] ?? overall;
  const primaryLabel = board.rankedBy === "best" ? "Best score" : "Average";
  const secondaryLabel = board.rankedBy === "best" ? "Average" : "Best score";

  return (
    <div className="space-y-2 sm:space-y-3">
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
              className="block text-xs font-medium text-foreground sm:text-sm"
            >
              Show ranking for
            </label>
            <select
              id="leaderboard-quiz"
              value={selected}
              onChange={(event) => setSelected(Number(event.target.value))}
              className="mt-1 h-9 w-full max-w-xs px-3 text-sm sm:h-10"
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
              <table className="w-full text-left text-xs sm:text-sm">
                <caption className="sr-only">
                  {board.quiz ?? "Overall"} leaderboard
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className={LB_CELL}>Rank</th>
                    <th scope="col" className={LB_CELL}>Student</th>
                    <th scope="col" className={LB_CELL}>{primaryLabel}</th>
                    <th scope="col" className={`${LB_CELL} ${LB_HIDE_SM}`}>
                      {secondaryLabel}
                    </th>
                    <th scope="col" className={`${LB_CELL} ${LB_HIDE_SM}`}>
                      Attempts
                    </th>
                    <th
                      scope="col"
                      className={`py-1.5 sm:py-2 ${LB_HIDE_MD}`}
                    >
                      Last active
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {board.entries.map((entry) => (
                    <tr key={entry.student}>
                      <td className={LB_CELL}>
                        <RankChip rank={entry.rank} />
                      </td>
                      <td className={`${LB_CELL} font-semibold text-foreground`}>
                        {entry.student}
                      </td>
                      <td className={LB_CELL}>
                        <ScoreBar
                          value={
                            board.rankedBy === "best"
                              ? entry.best
                              : entry.average
                          }
                        />
                      </td>
                      <td className={`${LB_CELL} ${LB_HIDE_SM}`}>
                        {Math.round(
                          (board.rankedBy === "best"
                            ? entry.average
                            : entry.best) * 10,
                        ) / 10}
                        %
                      </td>
                      <td className={`${LB_CELL} ${LB_HIDE_SM}`}>
                        {entry.attempts}
                      </td>
                      <td className={`py-1.5 sm:py-2 ${LB_HIDE_MD}`}>
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
  return (
    <div className="space-y-2 sm:space-y-3">
      <SectionHeading
        title="Settings"
        description="Review your teacher account details and keep your password up to date."
      />

      <ProfileCard role="teacher" />

      <SettingsPasswordForm sessionExpiredPath="/teacher-login?status=session_expired" />
    </div>
  );
}
