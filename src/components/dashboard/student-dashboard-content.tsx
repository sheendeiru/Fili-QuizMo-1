"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  LatestBreakdown,
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
  history: StudentHistoryRow[];
  summaryHistory: StudentHistoryRow[];
  historyTotal: number;
  historyPage: number;
  historyTotalPages: number;
};

const navItems: DashboardNavItem[] = [
  { key: "overview", label: "Overview" },
  { key: "quizzes", label: "My Quizzes" },
  { key: "history", label: "Quiz History" },
  { key: "assessment", label: "Assessment" },
  { key: "badges", label: "Achievements" },
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
  const latestRow = byDate[0];
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
    latest: same(latestRow?.percentage ?? null, analytics.kpis.latest)
      ? rawOf(latestRow)
      : null,
    retakes,
  };
}

function HistoryTable({
  rows,
  emptyMessage,
  page,
  totalPages,
  onPageChange,
}: {
  rows: StudentHistoryRow[];
  emptyMessage: string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <PaginatedTable
      caption="Quiz history"
      columns={[
        {
          key: "quiz",
          label: "Quiz",
          render: (row) => row.quiz_title ?? "Untitled quiz",
        },
        {
          key: "attempt",
          label: "Attempt",
          render: (row) => row.attempt_number ?? "—",
        },
        {
          key: "score",
          label: "Score",
          render: (row) =>
            `${row.correct_count ?? 0}/${row.total_questions ?? 0}`,
        },
        {
          key: "percentage",
          label: "Percentage",
          render: (row) => <PercentChip value={row.percentage} />,
        },
        {
          key: "completed",
          label: "Completed",
          render: (row) => formatDate(row.completed_at),
        },
        {
          key: "duration",
          label: "Duration",
          render: (row) => formatDuration(row.duration_seconds),
        },
      ]}
      rows={rows}
      rowKey={(row) =>
        `${row.attempt_id ?? row.session_id}-${row.attempt_number ?? 0}`
      }
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
      emptyMessage={emptyMessage}
    />
  );
}

export default function StudentDashboardContent({
  assignedQuizzes,
  profile,
  history,
  summaryHistory,
  historyTotal,
  historyPage,
  historyTotalPages,
}: StudentDashboardContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { navigate } = useNavigation();
  const search = searchParams.toString();
  const activeKey =
    searchParams.get("tab") === "quizzes"
      ? "quizzes"
      : searchParams.get("tab") === "history"
      ? "history"
      : searchParams.get("tab") === "assessment"
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

  const navigateToPage = useCallback(
    (page: number, replace = false) => {
      const params = new URLSearchParams(search);
      params.set("tab", "history");
      if (page === 1) {
        params.delete("page");
      } else {
        params.set("page", String(page));
      }
      navigate(() =>
        replace
          ? router.replace(`${pathname}?${params.toString()}`, {
              scroll: false,
            })
          : router.push(`${pathname}?${params.toString()}`, {
              scroll: false,
            }),
      );
    },
    [navigate, pathname, router, search],
  );

  useEffect(() => {
    if (activeKey === "history" && historyPage > historyTotalPages) {
      navigateToPage(historyTotalPages, true);
    }
  }, [activeKey, historyPage, historyTotalPages, navigateToPage]);

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
          <section>
            <h2 className="text-xl font-bold text-foreground">
              Welcome back, {profile.username ?? "Student"}!
            </h2>
            <p className="mt-1 text-sm text-px-muted">
              Here is a summary of your quiz activity.
            </p>
          </section>

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

          <section aria-label="Score summary">
            <StatGrid columns={4}>
              <StatCard
                label="Recorded attempts"
                value={String(historyTotal)}
                hint={`Latest ${summaryHistory.length} in the summary`}
              />
              <StatCard
                label="Average score"
                value={formatPercent(analytics?.kpis.average ?? null)}
                hint={`Latest ${summaryHistory.length} attempts`}
              />
              <StatCard
                label="Best score"
                value={
                  rawScores?.best ??
                  formatPercent(analytics?.kpis.best ?? null)
                }
                hint="Highest in latest results"
              />
              <StatCard
                label="Latest score"
                value={
                  rawScores?.latest ??
                  formatPercent(analytics?.kpis.latest ?? null)
                }
                hint={analytics?.kpis.latestQuiz ?? "No completed quiz yet"}
              />
            </StatGrid>
          </section>

          {analytics ? (
            <section aria-label="Performance charts">
              {/* Phones: one chart at a time behind tabs. md and up: 2-column grid. */}
              <ChartTabs
                label="Performance charts"
                tabs={[
                  {
                    key: "trend",
                    label: "Trend",
                    wide: !analytics.latestBreakdown,
                    content: (
                      <ChartCard
                        title="Score trend"
                        caption={`Your last ${analytics.trend.length} completed quiz${analytics.trend.length === 1 ? "" : "zes"}`}
                      >
                        <ScoreTrendChart points={analytics.trend} />
                      </ChartCard>
                    ),
                  },
                  ...(analytics.latestBreakdown
                    ? [
                        {
                          key: "latest",
                          label: "Latest",
                          content: (
                            <ChartCard
                              title="Latest quiz"
                              caption="How your most recent answers added up"
                            >
                              <LatestBreakdown data={analytics.latestBreakdown} />
                            </ChartCard>
                          ),
                        },
                      ]
                    : []),
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
                  ...(analytics.retakes.length > 0
                    ? [
                        {
                          key: "retakes",
                          label: "Retakes",
                          wide: true,
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
                ]}
              />
            </section>
          ) : null}

          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-foreground">
                Recent quiz history
              </h3>
              {historyTotal > 5 ? (
                <Button
                  type="button"
                  variant="accent"
                  size="sm"
                  onClick={() => navigateToSection("history")}
                >
                  View all
                </Button>
              ) : null}
            </div>
            <HistoryTable
              rows={summaryHistory.slice(0, 5)}
              page={1}
              totalPages={1}
              onPageChange={() => undefined}
              emptyMessage="No quiz results yet. Your completed quizzes will appear here."
            />
          </section>
        </div>
      ) : null}

      {activeKey === "quizzes" ? (
        <AssignedQuizzesSection quizzes={assignedQuizzes} />
      ) : null}

      {activeKey === "history" ? (
        <div className="space-y-2 sm:space-y-3">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Quiz History
            </h2>
            <p className="mt-1 text-sm text-px-muted">
              {historyTotal} recorded attempt
              {historyTotal === 1 ? "" : "s"}.
            </p>
          </div>
          <HistoryTable
            rows={history}
            page={historyPage}
            totalPages={historyTotalPages}
            onPageChange={navigateToPage}
            emptyMessage="No quiz results yet. Your completed quizzes will appear here."
          />
        </div>
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
