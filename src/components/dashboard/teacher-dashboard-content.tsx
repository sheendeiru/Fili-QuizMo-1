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
import { RecentScoresCard } from "@/components/dashboard/dashboard-charts";
import { ManageAccountsTable } from "@/components/dashboard/manage-accounts";
import { ClassProgress } from "@/components/dashboard/class-progress";
import { ManageClasses } from "@/components/dashboard/manage-classes";
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

// shortLabel is what the desktop navbar shows; the drawer, the tooltip and
// screen readers keep the full label.
const navItems: DashboardNavItem[] = [
  { key: "quizzes", label: "View Quizzes", shortLabel: "Quizzes" },
  { key: "students", label: "Manage Student Info", shortLabel: "Students" },
  { key: "classes", label: "My Classes", shortLabel: "Classes" },
  { key: "scores", label: "View Scores", shortLabel: "Scores" },
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
  classes: { slug: "classes", entity: null },
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
      {activeKey === "classes" && <ClassesSection />}
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

/**
 * View Quizzes is about the quiz library only: how many quizzes there are, what
 * state they are in, and the table to manage them. Student and score figures
 * live in their own sections.
 */
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
  return (
    <div className="space-y-2 sm:space-y-3">
      <SectionHeading
        title="View Quizzes"
        description="Your quiz library and what needs your attention."
      />

      {/* Needs attention: new student messages and low scores. Each one shows
          nothing when there is nothing to say. */}
      <UnreadMessagesNotice viewer="teacher" onOpen={onOpenMessages} />

      <PerformanceNotices
        notices={notices}
        actionLabel="Review"
        onAction={onReviewNotice}
      />

      <StatGrid columns={4}>
        <StatCard label="Total Quizzes" value={String(data.quizzes.total)} />
        <StatCard label="Ready" value={String(data.quizzes.ready)} />
        <StatCard label="Drafts" value={String(data.quizzes.draft)} />
        <StatCard label="Failed" value={String(data.quizzes.failed)} />
      </StatGrid>

      <ManageQuizzesTable actorRole="teacher" assignedTo={data.assignedTo} />
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

function ClassesSection() {
  return (
    <div className="space-y-2 sm:space-y-3">
      <SectionHeading
        title="My Classes"
        description="Group your students into classes. A quiz sent to a class reaches every student in it."
      />

      <ManageClasses />
    </div>
  );
}

/**
 * Students & Scores holds every score figure: the headline numbers, the two
 * charts, class progress and the searchable table. The numbers follow the
 * selected class (?class=...), the same filter the table uses.
 */
function ScoresSection({ data }: { data: TeacherDashboardData }) {
  const classId = useSearchParams().get("class") ?? "";
  const classView = data.classViews.find((item) => item.classId === classId);
  const results = classView?.results ?? data.results;
  const distributions = classView?.distributions ?? data.distributions;
  const activeStudents = classView ? classView.studentCount : data.studentCount;

  return (
    <div className="space-y-2 sm:space-y-3">
      <SectionHeading
        title="Students & Scores"
        description="Search students and review their quiz performances."
      />

      {/* Short labels so all three sit on one row, even on a phone. */}
      <StatGrid columns={3} phoneColumns={3}>
        <StatCard label="Average" value={`${results.average}%`} />
        <StatCard label="Students" value={String(activeStudents)} />
        <StatCard label="Quizzes" value={String(distributions.length)} />
      </StatGrid>

      {/* Phones: one chart at a time behind tabs. md and up: side by side. */}
      <ChartTabs
        label="Score charts"
        tabs={[
          {
            key: "distribution",
            label: "Distribution",
            content: (
              <ChartPanel
                title="Score Distribution"
                caption={
                  classView
                    ? `Score distribution per quiz for ${classView.name}.`
                    : "Student score distribution per quiz."
                }
              >
                <PieChart distributions={distributions} />
              </ChartPanel>
            ),
          },
          {
            key: "recent",
            label: "Recent scores",
            content: (
              <RecentScoresCard
                title="Recent Scores"
                description="The latest completed attempts on your quizzes."
                scores={data.recentScores}
              />
            ),
          },
        ]}
      />

      <ClassProgress classViews={data.classViews} selectedClassId={classId} />
      <SearchFilter
        role="teacher"
        entity="students"
        classOptions={data.classViews.map((item) => ({
          id: item.classId,
          name: item.name,
        }))}
      />
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
const LB_CELL = "py-1.5 pr-2 sm:py-2 sm:pr-3";
const LB_HIDE_SM = "hidden sm:table-cell";
const LB_HIDE_MD = "hidden md:table-cell";

function LeaderboardSection({ data }: { data: TeacherDashboardData }) {
  const [classId, setClassId] = useState("");
  const classView = data.classViews.find((item) => item.classId === classId);
  const { overall, byQuiz } = classView?.leaderboards ?? data.leaderboards;
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

      {data.classViews.length > 0 ? (
        <div>
          <label
            htmlFor="leaderboard-class"
            className="block text-xs font-medium text-foreground sm:text-sm"
          >
            Show students from
          </label>
          <select
            id="leaderboard-class"
            value={classId}
            onChange={(event) => {
              setClassId(event.target.value);
              setSelected(0);
            }}
            className="mt-1 h-9 w-full max-w-xs px-3 text-sm sm:h-10"
          >
            <option value="">All students</option>
            {data.classViews.map((item) => (
              <option key={item.classId} value={item.classId}>
                {item.name} ({item.studentCount})
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {overall.entries.length === 0 ? (
        <PixelCard>
          <p className="text-sm text-neutral-600">
            {classView
              ? `No quiz results from students in ${classView.name} yet. Rankings will appear once they finish a quiz.`
              : "No quiz results yet. Student rankings will appear here once quizzes are completed."}
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
                    <th scope="col" className={LB_CELL}>Points</th>
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
      <p className="text-[11px] leading-tight text-neutral-700 sm:text-xs">
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

      <p className="text-xs text-foreground sm:text-sm">
        <strong>Examples:</strong> {pointsExample(80, "8/10")} ·{" "}
        {pointsExample(100, "10/10")} · {pointsExample(30, "3/10")}
      </p>

      <p className="text-xs text-neutral-600 sm:text-sm">
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
