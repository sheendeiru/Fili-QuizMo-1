"use client";

import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
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
import { ManageAccountsTable } from "@/components/dashboard/manage-accounts";
import { TeacherAssessmentSection } from "@/components/dashboard/assessment-section";
import { PerformanceNotices } from "@/components/dashboard/performance-notices";
import { UnreadMessagesNotice } from "@/components/dashboard/unread-messages-notice";
import {
  teacherNotices,
  type PerformanceNotice,
} from "@/lib/dashboard/performance-notice";
import { ProfileCard } from "@/components/dashboard/profile-card";
import { SettingsPasswordForm } from "@/components/dashboard/settings-password-form";
import { useResetRouteState } from "@/lib/dashboard/route-reset";
import { logoutAndRedirect } from "@/lib/auth/logout";
import { useRealtimeRefresh } from "@/lib/realtime/use-realtime-refresh";
import type { TeacherDashboardData } from "@/lib/dashboard/data";
import { formatRawScore } from "@/lib/dashboard/raw-score";
import {
  MAX_POINTS_PER_QUIZ,
  POINTS,
  quizPoints,
} from "@/lib/dashboard/leaderboard";

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
  { key: "assessment", label: "Assessment" },
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
  assessment: { slug: "assessment", entity: null },
  leaderboard: { slug: "leaderboard", entity: null },
  settings: { slug: "settings", entity: null },
} as const;

type SectionKey = keyof typeof SECTION_ROUTES;

function sectionHref(key: SectionKey, attemptId: string | null = null): string {
  const route = SECTION_ROUTES[key];
  const params = new URLSearchParams();
  if (route.entity) {
    params.set("entity", route.entity);
  }
  if (attemptId) {
    params.set("attempt", attemptId);
  }
  const query = params.toString();

  return `${BASE_PATH}/${route.slug}${query ? `?${query}` : ""}`;
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

  const assessmentAttemptId =
    activeKey === "assessment" ? searchParams.get("attempt") : null;

  // Read once when the page opens; the notices look at the last two weeks.
  const [now] = useState(() => Date.now());
  const notices = useMemo(
    () =>
      teacherNotices(
        data.assessmentAttempts.map((attempt) => ({
          id: attempt.id,
          student: attempt.student,
          title: attempt.quizTitle,
          percentage: attempt.percentage,
          correct: attempt.correct,
          total: attempt.total,
          completedAt: attempt.completedAt,
        })),
        now,
      ),
    [data.assessmentAttempts, now],
  );

  useResetRouteState(
    "teacher-dashboard",
    sectionHref(activeKey, assessmentAttemptId),
  );
  useRealtimeRefresh(LIVE_TABLES);

  // Opening a student's answers (or going back to the list) only changes the
  // URL, so it does not trigger the page loading screen. Browser back works.
  function openAssessment(attemptId: string | null) {
    const query = attemptId ? `?attempt=${encodeURIComponent(attemptId)}` : "";

    window.history.pushState(null, "", `${pathname}${query}`);
    window.scrollTo({ top: 0 });
  }

  // "Review" on a warning: one student opens their answers, several open the list.
  function reviewNotice(notice: PerformanceNotice) {
    navigate(() =>
      router.push(sectionHref("assessment", notice.attemptId), {
        scroll: false,
      }),
    );
  }

  // "Read" on the new-message notice: one attempt opens its messages, several
  // open the Assessment list.
  function openMessages(attemptId: string | null) {
    navigate(() =>
      router.push(sectionHref("assessment", attemptId), { scroll: false }),
    );
  }

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
      {activeKey === "quizzes" && (
        <QuizzesSection
          data={data}
          notices={notices}
          onReviewNotice={reviewNotice}
          onOpenMessages={openMessages}
        />
      )}
      {activeKey === "students" && <StudentsSection />}
      {activeKey === "scores" && <ScoresSection data={data} />}
      {activeKey === "assessment" && (
        <TeacherAssessmentSection
          attempts={data.assessmentAttempts}
          attemptId={assessmentAttemptId}
          onSelect={openAssessment}
          onBack={() => openAssessment(null)}
        />
      )}
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
  /** Only when it says something the title does not. */
  caption?: string;
  children: ReactNode;
}) {
  return (
    <PixelCard as="article" className="h-full p-2! sm:p-2.5!">
      <h3 className="text-sm font-semibold text-foreground sm:text-base">
        {title}
      </h3>
      {caption ? (
        <p className="text-sm leading-snug text-neutral-600">{caption}</p>
      ) : null}
      <div className="mt-1.5">{children}</div>
    </PixelCard>
  );
}

const RECENT_SCORES_SHOWN = 5;

function recentScoreTone(score: number): string {
  if (score >= 75) return "bg-success";
  if (score >= 50) return "bg-px-gold";
  return "bg-danger-dark";
}

/**
 * The latest attempts, one tight row each: who and which quiz on the left,
 * the raw score on the right, and a thin bar underneath. Shows the newest few
 * and tucks the rest behind one button.
 */
function RecentScoresList({
  scores,
}: {
  scores: TeacherDashboardData["recentScores"];
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? scores : scores.slice(0, RECENT_SCORES_SHOWN);
  const hidden = scores.length - RECENT_SCORES_SHOWN;

  if (scores.length === 0) {
    return (
      <p className="text-sm text-neutral-700">
        Scores will appear after students finish a quiz.
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-1.5">
        {visible.map((entry) => {
          const percent = Math.round(Math.min(100, Math.max(0, entry.score)));
          const raw = formatRawScore(entry.correct, entry.total);

          return (
            <li key={entry.id}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-foreground">
                  <span className="font-semibold">{entry.student}</span>
                  <span className="text-neutral-600"> · {entry.quizTitle}</span>
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
                className="mt-0.5 h-2 border border-ink bg-px-cream"
              >
                <div
                  className={`h-full ${recentScoreTone(entry.score)}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {hidden > 0 ? (
        <button
          type="button"
          aria-expanded={showAll}
          onClick={() => setShowAll((open) => !open)}
          className="mt-1.5 text-sm font-semibold text-ink underline"
        >
          {showAll ? "Show fewer" : `Show ${hidden} more`}
        </button>
      ) : null}
    </>
  );
}

function QuizzesSection({
  data,
  notices,
  onReviewNotice,
  onOpenMessages,
}: {
  data: TeacherDashboardData;
  notices: PerformanceNotice[];
  onReviewNotice: (notice: PerformanceNotice) => void;
  onOpenMessages: (attemptId: string | null) => void;
}) {
  const { total, ready, draft, failed } = data.quizzes;

  return (
    <div className="space-y-2 sm:space-y-3">
      <SectionHeading
        title="View Quizzes"
        description="Your quiz library and what state each quiz is in."
      />

      {/* Alerts stay on the page you land on. Each one has a button that
          opens the right place (Assessment) for the details. */}
      <UnreadMessagesNotice viewer="teacher" onOpen={onOpenMessages} />

      <PerformanceNotices
        notices={notices}
        actionLabel="Review"
        onAction={onReviewNotice}
      />

      <StatGrid columns={4}>
        <StatCard label="Total Quizzes" value={String(total)} />
        <StatCard label="Ready" value={String(ready)} />
        <StatCard label="Drafts" value={String(draft)} />
        <StatCard label="Failed" value={String(failed)} />
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
        description="How your students are doing on your quizzes."
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

/** "1 attempt" / "3 attempts", so the number always reads as a count. */
function attemptsText(count: number): string {
  return `${count} ${count === 1 ? "attempt" : "attempts"}`;
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

function ScoreBar({ value, label }: { value: number; label?: string | null }) {
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
      <span
        className="font-semibold text-foreground"
        title={`${Math.round(value * 10) / 10}%`}
      >
        {label ?? `${Math.round(value * 10) / 10}%`}
      </span>
    </div>
  );
}

// Leaderboard table: tight cells on phones, with the extra columns tucked
// away until there is room (secondary score + attempts from sm, date from md).
const LB_CELL = "py-2 pr-2 align-top sm:pr-3";
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
              className="block text-sm font-medium text-foreground"
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
              <table className="w-full text-left text-sm">
                <caption className="sr-only">
                  {board.quiz ?? "Overall"} leaderboard
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className={LB_CELL}>Rank</th>
                    <th scope="col" className={LB_CELL}>Student</th>
                    <th scope="col" className={LB_CELL}>{primaryLabel}</th>
                    <th scope="col" className={LB_CELL}>Points</th>
                    <th scope="col" className={`${LB_CELL} ${LB_HIDE_SM}`}>
                      {secondaryLabel}
                    </th>
                    <th scope="col" className={`${LB_CELL} ${LB_HIDE_SM}`}>
                      Attempts
                    </th>
                    <th
                      scope="col"
                      className={`py-2 ${LB_HIDE_MD}`}
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
                        {/* Phones hide the extra columns, so the same facts
                            sit under the name instead. */}
                        <span className="mt-0.5 block text-sm font-normal text-neutral-600 sm:hidden">
                          {secondaryLabel}{" "}
                          {board.rankedBy === "best"
                            ? `${Math.round(entry.average * 10) / 10}%`
                            : (entry.bestRaw ??
                              `${Math.round(entry.best * 10) / 10}%`)}
                          {" · "}
                          {attemptsText(entry.attempts)}
                        </span>
                        <span className="mt-0.5 hidden text-sm font-normal text-neutral-600 sm:block md:hidden">
                          {attemptsText(entry.attempts)} · Last active{" "}
                          {formatDate(entry.lastCompletedAt)}
                        </span>
                      </td>
                      <td className={LB_CELL}>
                        <ScoreBar
                          value={
                            board.rankedBy === "best"
                              ? entry.best
                              : entry.average
                          }
                          label={
                            board.rankedBy === "best" ? entry.bestRaw : null
                          }
                        />
                      </td>
                      <td className={`${LB_CELL} font-bold text-foreground`}>
                        {entry.points}
                      </td>
                      <td className={`${LB_CELL} ${LB_HIDE_SM}`}>
                        {board.rankedBy === "best"
                          ? `${Math.round(entry.average * 10) / 10}%`
                          : (entry.bestRaw ??
                            `${Math.round(entry.best * 10) / 10}%`)}
                      </td>
                      <td className={`${LB_CELL} ${LB_HIDE_SM}`}>
                        {attemptsText(entry.attempts)}
                      </td>
                      <td className={`py-2 align-top ${LB_HIDE_MD}`}>
                        {formatDate(entry.lastCompletedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PointsMethod />
          </ChartPanel>
        </>
      )}
    </div>
  );
}

/** One box of the points equation: a big value with a short caption. */
function PointsTerm({
  value,
  label,
  tone = "bg-surface",
}: {
  value: string;
  label: string;
  tone?: string;
}) {
  return (
    <div
      className={`min-w-0 flex-1 basis-24 border-2 border-ink px-2 py-1 text-center ${tone}`}
    >
      <p className="text-sm font-bold leading-tight text-ink sm:text-base">
        {value}
      </p>
      <p className="text-xs leading-tight text-neutral-700 sm:text-sm">
        {label}
      </p>
    </div>
  );
}

function PointsOperator({ symbol }: { symbol: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex w-4 shrink-0 items-center justify-center text-base font-bold text-ink"
    >
      {symbol}
    </span>
  );
}

/** "8/10 → 8 + 2 = 10 points", built from the same rule the table uses. */
function pointsExample(percentage: number, raw: string): string {
  const parts = [
    Math.round(percentage / POINTS.scoreDivisor),
    POINTS.completion,
    ...(percentage >= 100 ? [POINTS.perfect] : []),
  ];

  return `${raw} → ${parts.join(" + ")} = ${quizPoints(percentage)} points`;
}

/**
 * The points rule, always visible under the table: each quiz is
 * (score part) + (finished) + (perfect bonus), drawn as a small equation so it
 * reads at a glance. Every number comes from POINTS in leaderboard.ts.
 */
function PointsMethod() {
  return (
    <section
      aria-label="How points are calculated"
      className="mt-3 space-y-2 border-2 border-ink bg-neutral-100 p-2.5"
    >
      <h4 className="text-sm font-bold text-foreground">
        How points work{" "}
        <span className="font-normal text-neutral-600">(for each quiz)</span>
      </h4>

      <div className="flex flex-wrap items-stretch gap-1.5">
        <PointsTerm
          value={`0–${100 / POINTS.scoreDivisor}`}
          label={`Best score ÷ ${POINTS.scoreDivisor}`}
        />
        <PointsOperator symbol="+" />
        <PointsTerm value={`+${POINTS.completion}`} label="Finished the quiz" />
        <PointsOperator symbol="+" />
        <PointsTerm
          value={`+${POINTS.perfect}`}
          label="Perfect score (100%)"
          tone="bg-primary"
        />
        <PointsOperator symbol="=" />
        <PointsTerm
          value={`Up to ${MAX_POINTS_PER_QUIZ}`}
          label="Per quiz"
          tone="bg-accent"
        />
      </div>

      <p className="text-sm text-foreground">
        <strong>Examples:</strong> {pointsExample(80, "8/10")} ·{" "}
        {pointsExample(100, "10/10")} · {pointsExample(30, "3/10")}
      </p>

      <p className="text-sm text-neutral-700">
        Only the best try on each quiz counts, so retakes add no extra points.
        The overall board adds up every quiz. Rank order still follows the
        score shown.
      </p>
    </section>
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
