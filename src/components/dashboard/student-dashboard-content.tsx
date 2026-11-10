"use client";

import { useMemo, useState } from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { DashboardNavItem } from "@/components/dashboard/dashboard-shell";
import {
  AverageByQuiz,
  ChartCard,
  PercentChip,
  RetakeProgress,
  ScoreBands,
  ScoreTrendChart,
} from "@/components/dashboard/student-charts";
import { buildStudentAnalytics } from "@/lib/dashboard/student-analytics";
import { formatRawScore } from "@/lib/dashboard/raw-score";
import { logoutAndRedirect } from "@/lib/auth/logout";
import { useResetRouteState } from "@/lib/dashboard/route-reset";
import { useNavigation } from "@/components/pixel";
import { Button } from "@/components/ui/button";
import { PaginatedTable } from "@/components/ui/paginated-table";
import { PixelCard } from "@/components/ui/pixel-primitives";
import { AssessmentSection } from "@/components/dashboard/assessment-section";
import { AssignedQuizzesSection } from "@/components/dashboard/assigned-quizzes-section";
import type { AssignedQuiz } from "@/lib/classes/client";
import { BadgesSection } from "@/components/dashboard/badges-section";
import { UnreadMessagesNotice } from "@/components/dashboard/unread-messages-notice";
import { PerformanceNotices } from "@/components/dashboard/performance-notices";
import { studentNotice } from "@/lib/dashboard/performance-notice";
import {
  ChartTabs,
  StatCard,
  StatGrid,
} from "@/components/dashboard/compact-layout";

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
  /** Quizzes sent to this student; null when the quiz server is unreachable. */
  assignedQuizzes: readonly AssignedQuiz[] | null;
  profile: {
    username: string | null;
    email: string | null;
    createdAt: string | null;
  };
  /**
   * Quiz History was merged into Assessment, so these three are no longer
   * used here. They stay optional so the page can keep passing them until it
   * stops loading the paginated history.
   */
  history?: StudentHistoryRow[];
  historyPage?: number;
  historyTotalPages?: number;
  summaryHistory: StudentHistoryRow[];
  historyTotal: number;
};

const navItems: DashboardNavItem[] = [
  { key: "overview", label: "Overview" },
  // shortLabel is what the compact navbar shows; the drawer uses the full label.
  { key: "quizzes", label: "My Quizzes", shortLabel: "Quizzes" },
  { key: "assessment", label: "Assessment" },
  { key: "badges", label: "Achievements", shortLabel: "Badges" },
  { key: "profile", label: "Profile" },
];

/** How many of the newest attempts the Overview lists. */
const RECENT_ATTEMPTS_SHOWN = 5;

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

type RawPair = { first: string; latest: string };

function rawOf(row: StudentHistoryRow | undefined): string | null {
  return row ? formatRawScore(row.correct_count, row.total_questions) : null;
}

function completedTime(row: StudentHistoryRow): number {
  return Date.parse(row.completed_at ?? "") || 0;
}

/**
 * Raw scores (e.g. 8/10) for the percentages the overview cards show. Each raw
 * value is only used when its attempt's percentage matches the analytics value,
 * so a card never shows a raw score from a different attempt. When there is no
 * match, the card keeps its percentage.
 */
function buildRawScores(
  rows: readonly StudentHistoryRow[],
  analytics: NonNullable<ReturnType<typeof buildStudentAnalytics>>,
) {
  const same = (a: number | null, b: number) =>
    a !== null && Math.round(a) === Math.round(b);
  const scored = rows.filter(
    (row) => row.percentage !== null && Number.isFinite(row.percentage),
  );
  // Newest first.
  const byDate = [...scored].sort(
    (left, right) => completedTime(right) - completedTime(left),
  );
  const bestRow = byDate.reduce<StudentHistoryRow | undefined>(
    (best, row) =>
      !best || (row.percentage ?? 0) > (best.percentage ?? 0) ? row : best,
    undefined,
  );

  const retakes = new Map<string, RawPair>();
  for (const retake of analytics.retakes) {
    const attempts = byDate
      .filter((row) => row.quiz_title === retake.quiz)
      .reverse();
    const first = attempts[0];
    const latest = attempts[attempts.length - 1];
    const firstRaw = rawOf(first);
    const latestRaw = rawOf(latest);

    if (
      firstRaw &&
      latestRaw &&
      same(first.percentage, retake.first) &&
      same(latest.percentage, retake.latest)
    ) {
      retakes.set(retake.quiz, { first: firstRaw, latest: latestRaw });
    }
  }

  return {
    best: same(bestRow?.percentage ?? null, analytics.kpis.best)
      ? rawOf(bestRow)
      : null,
    retakes,
  };
}

/**
 * The newest few attempts, three columns so it fits a phone without scrolling.
 * The full list (with message badges and paging) lives in Assessment.
 */
function RecentAttemptsTable({
  rows,
  onReview,
}: {
  rows: StudentHistoryRow[];
  onReview: (attemptId: string) => void;
}) {
  return (
    <PaginatedTable
      caption="Recent quiz attempts"
      columns={[
        {
          key: "quiz",
          label: "Quiz",
          render: (row) => (
            <span className="block">
              <span className="block font-semibold text-foreground">
                {row.quiz_title ?? "Untitled quiz"}
              </span>
              <span className="mt-0.5 block font-normal text-neutral-600">
                Attempt {row.attempt_number ?? "—"} ·{" "}
                {formatDate(row.completed_at)}
              </span>
            </span>
          ),
        },
        {
          key: "score",
          label: "Score",
          className: "whitespace-nowrap",
          render: (row) => (
            <span className="inline-flex items-center gap-2">
              <span>
                {formatRawScore(row.correct_count, row.total_questions) ??
                  `${row.correct_count ?? 0}/${row.total_questions ?? 0}`}
              </span>
              <PercentChip value={row.percentage} />
            </span>
          ),
        },
        {
          key: "review",
          label: "Answers",
          className: "whitespace-nowrap",
          render: (row) =>
            row.attempt_id ? (
              <Button
                type="button"
                size="sm"
                onClick={() => onReview(row.attempt_id as string)}
              >
                Review
              </Button>
            ) : (
              "—"
            ),
        },
      ]}
      rows={rows}
      rowKey={(row) =>
        `${row.attempt_id ?? row.session_id}-${row.attempt_number ?? 0}`
      }
      page={1}
      totalPages={1}
      onPageChange={() => undefined}
      hidePagerWhenSinglePage
      emptyMessage="No quiz results yet. Your completed quizzes will appear here."
    />
  );
}

export default function StudentDashboardContent({
  assignedQuizzes,
  profile,
  summaryHistory,
  historyTotal,
}: StudentDashboardContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { navigate } = useNavigation();
  const search = searchParams.toString();
  const activeKey =
    searchParams.get("tab") === "quizzes"
      ? "quizzes"
      : // Quiz History was merged into Assessment; old links land there.
        searchParams.get("tab") === "assessment" ||
          searchParams.get("tab") === "history"
        ? "assessment"
        : searchParams.get("tab") === "badges"
          ? "badges"
          : searchParams.get("tab") === "profile"
            ? "profile"
            : "overview";
  const assessmentAttemptId =
    activeKey === "assessment" ? searchParams.get("attempt") : null;
  const analytics = useMemo(
    () => buildStudentAnalytics(summaryHistory),
    [summaryHistory],
  );
  const rawScores = useMemo(
    () => (analytics ? buildRawScores(summaryHistory, analytics) : null),
    [analytics, summaryHistory],
  );
  // Read once when the page opens; the notice looks at the last two weeks.
  const [now] = useState(() => Date.now());
  const notice = useMemo(
    () =>
      studentNotice(
        summaryHistory.map((row) => ({
          id: row.attempt_id,
          title: row.quiz_title,
          percentage: row.percentage,
          correct: row.correct_count,
          total: row.total_questions,
          completedAt: row.completed_at,
        })),
        now,
      ),
    [summaryHistory, now],
  );
  const cleanParams = new URLSearchParams();
  if (activeKey !== "overview") {
    cleanParams.set("tab", activeKey);
  }
  if (activeKey === "assessment" && assessmentAttemptId) {
    cleanParams.set("attempt", assessmentAttemptId);
  }
  const cleanQuery = cleanParams.toString();
  const cleanHref = cleanQuery ? `${pathname}?${cleanQuery}` : pathname;

  useResetRouteState("student-dashboard", cleanHref);

  function navigateToSection(tab: string) {
    const target = tab === "overview" ? pathname : `${pathname}?tab=${tab}`;
    if (target === `${pathname}${search ? `?${search}` : ""}`) {
      return;
    }

    navigate(() => router.push(target, { scroll: false }));
  }

  // Opening a quiz review (or going back to the list) only changes the URL, so
  // it does not trigger the page loading screen. The browser back button works.
  function openAssessment(attemptId: string | null) {
    const params = new URLSearchParams({ tab: "assessment" });
    if (attemptId) {
      params.set("attempt", attemptId);
    }

    window.history.pushState(null, "", `${pathname}?${params.toString()}`);
    window.scrollTo({ top: 0 });
  }

  // The charts, paired so each row holds two of a kind (the two drawn charts,
  // then the two lists) and the grid never ends with an empty cell: with an odd
  // number the first (the trend line, which likes the width) spans both columns.
  const chartTabsBase = analytics
    ? [
        {
          key: "trend",
          label: "Trend",
          content: (
            <ChartCard
              title="Score trend"
              caption={`Your last ${analytics.trend.length} completed quiz${analytics.trend.length === 1 ? "" : "zes"}`}
            >
              <ScoreTrendChart points={analytics.trend} />
            </ChartCard>
          ),
        },
        {
          key: "bands",
          label: "Bands",
          content: (
            <ChartCard
              title="Score bands"
              caption="How many quizzes landed in each range"
            >
              <ScoreBands bands={analytics.bands} />
            </ChartCard>
          ),
        },
        {
          key: "byQuiz",
          label: "By quiz",
          content: (
            <ChartCard
              title="Average by quiz"
              caption="Your strongest quizzes first"
            >
              <AverageByQuiz rows={analytics.byQuiz} />
            </ChartCard>
          ),
        },
        ...(analytics.retakes.length > 0
          ? [
              {
                key: "retakes",
                label: "Retakes",
                content: (
                  <ChartCard
                    title="Retake progress"
                    caption="First attempt compared with your latest"
                  >
                    <RetakeProgress
                      rows={analytics.retakes}
                      raw={rawScores?.retakes}
                    />
                  </ChartCard>
                ),
              },
            ]
          : []),
      ]
    : [];
  const chartTabs = chartTabsBase.map((tab, index) => ({
    ...tab,
    wide: chartTabsBase.length % 2 === 1 && index === 0,
  }));

  return (
    <DashboardShell
      role="Student"
      navItems={navItems}
      activeKey={activeKey}
      onNavigate={navigateToSection}
      onLogout={() => logoutAndRedirect(router, navigate)}
    >
      {activeKey === "overview" ? (
        <div className="space-y-2 sm:space-y-3">
          <h2 className="text-xl font-bold text-foreground">
            Welcome back, {profile.username ?? "Student"}!
          </h2>

          {/* Needs attention: new messages and how the last quiz went. Each one
              shows nothing when there is nothing to say. */}
          <UnreadMessagesNotice
            viewer="student"
            onOpen={(attemptId) =>
              attemptId
                ? openAssessment(attemptId)
                : navigateToSection("assessment")
            }
          />

          <PerformanceNotices
            notices={notice ? [notice] : []}
            actionLabel="Review answers"
            onAction={(item) =>
              item.attemptId
                ? openAssessment(item.attemptId)
                : navigateToSection("assessment")
            }
          />

          {/* Progress: the totals and the charts that explain them. */}
          <section aria-labelledby="student-progress-title" className="space-y-2">
            <h3
              id="student-progress-title"
              className="text-base font-semibold text-foreground"
            >
              Your progress
            </h3>

            {/* Short labels so all three fit on one phone row. */}
            <StatGrid columns={3} phoneColumns={3}>
              <StatCard
                label="Attempts"
                value={String(historyTotal)}
                hint="With retakes"
              />
              <StatCard
                label="Average"
                value={formatPercent(analytics?.kpis.average ?? null)}
                hint={`Latest ${summaryHistory.length}`}
              />
              <StatCard
                label="Best score"
                value={
                  rawScores?.best ??
                  formatPercent(analytics?.kpis.best ?? null)
                }
                hint="Highest result"
              />
            </StatGrid>

            {chartTabs.length > 0 ? (
              // Phones: one chart at a time behind tabs. md and up: 2-column grid.
              <ChartTabs label="Performance charts" tabs={chartTabs} />
            ) : null}
          </section>

          {/* Recent: the newest attempts, with a shortcut to review each one. */}
          <section aria-labelledby="student-recent-title">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3
                id="student-recent-title"
                className="min-w-0 text-base font-semibold text-foreground"
              >
                Recent attempts
              </h3>
              {summaryHistory.length > RECENT_ATTEMPTS_SHOWN ? (
                <Button
                  type="button"
                  variant="accent"
                  size="sm"
                  className="shrink-0 whitespace-nowrap"
                  onClick={() => navigateToSection("assessment")}
                >
                  View all
                </Button>
              ) : null}
            </div>
            <RecentAttemptsTable
              rows={summaryHistory.slice(0, RECENT_ATTEMPTS_SHOWN)}
              onReview={openAssessment}
            />
          </section>
        </div>
      ) : null}

      {activeKey === "quizzes" ? (
        <AssignedQuizzesSection quizzes={assignedQuizzes} />
      ) : null}

      {activeKey === "assessment" ? (
        <AssessmentSection
          attempts={summaryHistory}
          attemptId={assessmentAttemptId}
          onSelect={openAssessment}
          onBack={() => openAssessment(null)}
        />
      ) : null}

      {activeKey === "badges" ? (
        <BadgesSection />
      ) : null}

      {activeKey === "profile" ? (
        <div className="max-w-xl space-y-3">
          <h2 className="text-xl font-bold text-foreground">Profile</h2>
          <PixelCard as="article" className="divide-y divide-neutral-200">
            <dl>
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
          </PixelCard>
        </div>
      ) : null}
    </DashboardShell>
  );
}
