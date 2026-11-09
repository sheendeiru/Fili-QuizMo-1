"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ComponentProps } from "react";
import {
  PixelBadge,
  PixelButton,
  PixelCard,
} from "@/components/ui/pixel-primitives";
import { PaginatedTable } from "@/components/ui/paginated-table";
import { StatCard, StatGrid } from "@/components/dashboard/compact-layout";
import {
  ChartCard,
  LatestBreakdown,
  PercentChip,
} from "@/components/dashboard/student-charts";
import type { StudentHistoryRow } from "@/components/dashboard/student-dashboard-content";
import type { DashboardAttempt } from "@/lib/dashboard/data";
import { formatRawScore } from "@/lib/dashboard/raw-score";
import { FEEDBACK_MAX_LENGTH } from "@/lib/dashboard/assessment";
import {
  MAX_ATTEMPTS_PER_STUDENT_QUIZ,
  buildAttemptHistory,
  filterHistory,
  sortHistory,
  type HistoryFilter,
  type HistoryRow,
  type HistorySort,
} from "@/lib/dashboard/attempt-history";
import {
  UnreadMessagesNotice,
  useRefreshOnReturn,
} from "@/components/dashboard/unread-messages-notice";
import { LOW_SCORE_BELOW } from "@/lib/dashboard/performance-notice";
import type {
  AnswerStatus,
  Assessment,
  AssessmentChoice,
  AssessmentQuestion,
  AttemptFeedback,
  FeedbackCount,
} from "@/lib/dashboard/assessment";

const PAGE_SIZE = 5;

type Viewer = "student" | "teacher";

/**
 * How many messages each attempt has and who wrote the last one, for the list
 * badges. A failure here is silent: the badges are a convenience, the lists
 * still work without them.
 */
function useFeedbackCounts(): Record<string, FeedbackCount> {
  const [counts, setCounts] = useState<Record<string, FeedbackCount>>({});

  const load = useCallback((signal?: AbortSignal) => {
    fetch("/api/assessment/feedback", { signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;

        const body: unknown = await response.json();

        if (
          typeof body === "object" &&
          body !== null &&
          "counts" in body &&
          typeof body.counts === "object" &&
          body.counts !== null
        ) {
          setCounts(body.counts as Record<string, FeedbackCount>);
        }
      })
      .catch(() => {
        /* badges are optional */
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Pick up replies that arrive while this page stays open.
  const refresh = useCallback(() => load(), [load]);
  useRefreshOnReturn(refresh);

  return counts;
}

type NoteFilter = "" | "replied" | "with" | "without";

type SortKey = "newest" | "highest" | "lowest" | "name";

/** Message filters live in the same "Sort by" list as the orderings. */
const MESSAGE_OPTIONS: { key: Exclude<NoteFilter, "">; label: string }[] = [
  { key: "replied", label: "Student replied" },
  { key: "without", label: "No messages yet" },
  { key: "with", label: "Has messages" },
];

const HISTORY_SORT_OPTIONS: { key: HistorySort; label: string }[] = [
  { key: "name", label: "Student name (A–Z)" },
  { key: "attempts", label: "Most attempts" },
  { key: "improved", label: "Biggest improvement" },
  { key: "dropped", label: "Biggest drop" },
  { key: "recent", label: "Latest activity" },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "All attempts (newest first)" },
  { key: "highest", label: "Highest score first" },
  { key: "lowest", label: "Lowest score first" },
  { key: "name", label: "Student name (A–Z)" },
];

/** Raw score as a share (8/10 -> 0.8), so different quiz lengths compare fairly. */
function scoreShare(attempt: DashboardAttempt): number {
  return attempt.correct !== null && attempt.total
    ? attempt.correct / attempt.total
    : attempt.percentage / 100;
}

function completedTime(attempt: DashboardAttempt): number {
  return Date.parse(attempt.completedAt) || 0;
}

function sortAttempts(
  attempts: readonly DashboardAttempt[],
  sort: SortKey,
): DashboardAttempt[] {
  const newest = (left: DashboardAttempt, right: DashboardAttempt) =>
    completedTime(right) - completedTime(left);

  return [...attempts].sort((left, right) => {
    switch (sort) {
      case "highest":
        return (
          scoreShare(right) - scoreShare(left) ||
          (right.correct ?? 0) - (left.correct ?? 0) ||
          newest(left, right)
        );
      case "lowest":
        return scoreShare(left) - scoreShare(right) || newest(left, right);
      case "name":
        return (
          left.student.localeCompare(right.student) || newest(left, right)
        );
      default:
        return newest(left, right);
    }
  });
}

/**
 * Small badge for the lists. A teacher is told when the student wrote last
 * (that is the one that needs an answer); everyone else just sees a count.
 */
function FeedbackBadge({
  info,
  viewer,
}: {
  info: FeedbackCount | undefined;
  viewer: Viewer;
}) {
  if (!info) return null;

  if (viewer === "teacher" && info.lastRole === "student") {
    return <PixelBadge variant="warning">Student replied</PixelBadge>;
  }

  return (
    <PixelBadge variant="info">
      {info.count === 1 ? "1 message" : `${info.count} messages`}
    </PixelBadge>
  );
}

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeZone: "Asia/Manila",
});

function formatDate(value: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

type AssessmentSectionProps = {
  /** The student's finished attempts (same rows as the history table). */
  attempts: StudentHistoryRow[];
  /** The attempt being reviewed, or null to show the list of quizzes. */
  attemptId: string | null;
  onSelect: (attemptId: string) => void;
  onBack: () => void;
};

export function AssessmentSection({
  attempts,
  attemptId,
  onSelect,
  onBack,
}: AssessmentSectionProps) {
  if (attemptId) {
    return (
      <AssessmentReview
        // A new attempt starts with fresh filters and a fresh request.
        key={attemptId}
        viewer="student"
        attemptId={attemptId}
        known={attempts.find((row) => row.attempt_id === attemptId)}
        onBack={onBack}
      />
    );
  }

  return <AttemptList attempts={attempts} onSelect={onSelect} />;
}

/* ------------------------------------------------------------------ */
/* List of quizzes the student took                                    */
/* ------------------------------------------------------------------ */

function AttemptList({
  attempts,
  onSelect,
}: {
  attempts: StudentHistoryRow[];
  onSelect: (attemptId: string) => void;
}) {
  const [page, setPage] = useState(1);
  const noteCounts = useFeedbackCounts();
  const reviewable = attempts.filter((row) => row.attempt_id !== null);
  const totalPages = Math.max(1, Math.ceil(reviewable.length / PAGE_SIZE));
  const validPage = Math.min(page, totalPages);
  const rows = reviewable.slice(
    (validPage - 1) * PAGE_SIZE,
    validPage * PAGE_SIZE,
  );

  // Same recorded numbers as the history table, added up.
  const totals = reviewable.reduce(
    (sum, row) => {
      const total = row.total_questions ?? 0;
      const correct = row.correct_count ?? 0;
      const answered = Math.min(row.answered_count ?? correct, total);

      return {
        correct: sum.correct + correct,
        wrong: sum.wrong + Math.max(answered - correct, 0),
        skipped: sum.skipped + Math.max(total - answered, 0),
        total: sum.total + total,
      };
    },
    { correct: 0, wrong: 0, skipped: 0, total: 0 },
  );

  return (
    <div className="space-y-2 sm:space-y-3">
      <section>
        <h2 className="text-xl font-bold text-foreground">Assessment</h2>
        <p className="mt-1 text-sm text-px-muted">
          Pick a quiz to see which answers were right, which were wrong, and
          what the correct answer was.
        </p>
      </section>

      {reviewable.length === 0 ? (
        <PixelCard>
          <p className="text-sm text-neutral-600">
            No finished quizzes yet. When you complete a quiz, you can review
            your answers here.
          </p>
        </PixelCard>
      ) : (
        <>
          <section aria-label="Answer summary">
            <StatGrid columns={3}>
              <StatCard
                label="Correct answers"
                value={`${totals.correct}/${totals.total}`}
                hint={`Latest ${reviewable.length} attempts`}
              />
              <StatCard label="Wrong answers" value={String(totals.wrong)} />
              <StatCard label="Skipped" value={String(totals.skipped)} />
            </StatGrid>
          </section>

          <PaginatedTable
            caption="Quizzes you can review"
            columns={[
              {
                key: "quiz",
                label: "Quiz",
                render: (row) => (
                  <span className="block">
                    <span className="block font-semibold text-foreground">
                      {row.quiz_title ?? "Untitled quiz"}
                    </span>
                    <span className="block text-xs text-neutral-500">
                      Attempt {row.attempt_number ?? "—"}
                    </span>
                    {row.attempt_id && noteCounts[row.attempt_id] ? (
                      <span className="mt-1 block">
                        <FeedbackBadge
                          info={noteCounts[row.attempt_id]}
                          viewer="student"
                        />
                      </span>
                    ) : null}
                  </span>
                ),
              },
              {
                key: "score",
                label: "Score",
                className: "whitespace-nowrap",
                render: (row) =>
                  formatRawScore(row.correct_count, row.total_questions) ??
                  "—",
              },
              {
                key: "review",
                label: "Answers",
                className: "whitespace-nowrap",
                render: (row) => (
                  <PixelButton
                    type="button"
                    variant="primary"
                    size="sm"
                    className="whitespace-nowrap"
                    onClick={() => row.attempt_id && onSelect(row.attempt_id)}
                  >
                    Review
                  </PixelButton>
                ),
              },
              {
                key: "percentage",
                label: "Percentage",
                render: (row) => <PercentChip value={row.percentage} />,
              },
              {
                key: "completed",
                label: "Completed",
                className: "whitespace-nowrap",
                render: (row) => formatDate(row.completed_at),
              },
            ]}
            rows={rows}
            rowKey={(row) => row.attempt_id ?? `${row.session_id}-${row.attempt_number}`}
            page={validPage}
            totalPages={totalPages}
            onPageChange={setPage}
            emptyMessage="No finished quizzes yet."
          />
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Teacher view: every student's attempts on this teacher's quizzes    */
/* ------------------------------------------------------------------ */

export function TeacherAssessmentSection({
  attempts,
  attemptId,
  onSelect,
  onBack,
}: {
  attempts: DashboardAttempt[];
  attemptId: string | null;
  onSelect: (attemptId: string) => void;
  onBack: () => void;
}) {
  if (attemptId) {
    const known = attempts.find((attempt) => attempt.id === attemptId);

    return (
      <AssessmentReview
        key={attemptId}
        viewer="teacher"
        attemptId={attemptId}
        studentName={known?.student}
        fallbackTitle={known?.quizTitle}
        fallbackDate={known?.completedAt}
        onBack={onBack}
      />
    );
  }

  return <TeacherAttemptList attempts={attempts} onSelect={onSelect} />;
}

function TeacherAttemptList({
  attempts,
  onSelect,
}: {
  attempts: DashboardAttempt[];
  onSelect: (attemptId: string) => void;
}) {
  const [quiz, setQuiz] = useState("");
  const [student, setStudent] = useState("");
  const [noteFilter, setNoteFilter] = useState<NoteFilter>("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [view, setView] = useState<"attempts" | "history">("attempts");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [historySort, setHistorySort] = useState<HistorySort>("name");
  const [page, setPage] = useState(1);
  const noteCounts = useFeedbackCounts();

  const quizTitles = useMemo(
    () =>
      [...new Set(attempts.map((attempt) => attempt.quizTitle))].sort(
        (left, right) => left.localeCompare(right),
      ),
    [attempts],
  );

  const needle = student.trim().toLowerCase();
  const filtered = attempts.filter(
    (attempt) =>
      (quiz === "" || attempt.quizTitle === quiz) &&
      (needle === "" || attempt.student.toLowerCase().includes(needle)) &&
      // The message filter belongs to the Attempts view only.
      (view !== "attempts" ||
        noteFilter === "" ||
        (noteFilter === "replied"
          ? noteCounts[attempt.id]?.lastRole === "student"
          : (noteFilter === "with") === Boolean(noteCounts[attempt.id]))),
  );
  // History groups the same filtered attempts by student and quiz.
  const historyAll =
    view === "history"
      ? sortHistory(
          filterHistory(
            buildAttemptHistory(filtered),
            historyFilter,
            LOW_SCORE_BELOW,
          ),
          historySort,
        )
      : [];
  const itemCount = view === "history" ? historyAll.length : filtered.length;
  const totalPages = Math.max(1, Math.ceil(itemCount / PAGE_SIZE));
  const validPage = Math.min(page, totalPages);
  const pageStart = (validPage - 1) * PAGE_SIZE;
  const rows = sortAttempts(filtered, sort).slice(
    pageStart,
    pageStart + PAGE_SIZE,
  );
  const historyRows = historyAll.slice(pageStart, pageStart + PAGE_SIZE);

  // Same recorded numbers as the rest of the dashboard, for the filtered set.
  const correctSum = filtered.reduce((sum, a) => sum + (a.correct ?? 0), 0);
  const totalSum = filtered.reduce((sum, a) => sum + (a.total ?? 0), 0);
  const average =
    filtered.length === 0
      ? 0
      : Math.round(
          (filtered.reduce((sum, a) => sum + a.percentage, 0) /
            filtered.length) *
            10,
        ) / 10;

  return (
    <div className="space-y-2 sm:space-y-3">
      <UnreadMessagesNotice
        viewer="teacher"
        onOpen={(attemptId) => {
          if (attemptId) {
            onSelect(attemptId);
            return;
          }

          // Several attempts have new messages: list the ones students replied to.
          setView("attempts");
          setQuiz("");
          setStudent("");
          setNoteFilter("replied");
          setPage(1);
        }}
      />

      <section className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-foreground">Assessment</h2>
          <p className="mt-1 text-sm text-px-muted">
            Review each student&apos;s answers, or see how their scores moved
            across retakes.
          </p>
        </div>
        {attempts.length > 0 ? (
          <div role="group" aria-label="View" className="flex gap-1.5">
            {(
              [
                { key: "attempts", label: "Attempts" },
                { key: "history", label: "History" },
              ] as const
            ).map((option) => (
              <PixelButton
                key={option.key}
                type="button"
                size="sm"
                variant={view === option.key ? "primary" : "neutral"}
                aria-pressed={view === option.key}
                onClick={() => {
                  setView(option.key);
                  setPage(1);
                }}
              >
                {option.label}
              </PixelButton>
            ))}
          </div>
        ) : null}
      </section>

      {attempts.length === 0 ? (
        <PixelCard>
          <p className="text-sm text-neutral-600">
            No finished quizzes yet. Student answers will appear here once they
            complete one of your quizzes.
          </p>
        </PixelCard>
      ) : (
        <>
          <PixelCard className="space-y-2 p-2.5! sm:space-y-3 sm:p-3!">
            <div
              className={`grid grid-cols-1 gap-2 sm:gap-3 ${
                view === "attempts"
                  ? "sm:grid-cols-3"
                  : "sm:grid-cols-2 lg:grid-cols-4"
              }`}
            >
              <label
                htmlFor="assessment-quiz"
                className="block text-xs font-medium sm:text-sm"
              >
                Quiz
                <select
                  id="assessment-quiz"
                  value={quiz}
                  onChange={(event) => {
                    setQuiz(event.currentTarget.value);
                    setPage(1);
                  }}
                  className="pixel-input mt-1 h-10 w-full px-3 text-sm md:h-9"
                >
                  <option value="">All quizzes</option>
                  {quizTitles.map((title) => (
                    <option key={title} value={title}>
                      {title}
                    </option>
                  ))}
                </select>
              </label>
              <label
                htmlFor="assessment-student"
                className="block text-xs font-medium sm:text-sm"
              >
                Student
                <input
                  id="assessment-student"
                  type="search"
                  value={student}
                  maxLength={100}
                  placeholder="Search by student name"
                  onChange={(event) => {
                    setStudent(event.currentTarget.value);
                    setPage(1);
                  }}
                  className="pixel-input mt-1 h-10 w-full px-3 text-sm md:h-9"
                />
              </label>
              {view === "history" ? (
                <label
                  htmlFor="assessment-show"
                  className="block text-xs font-medium sm:text-sm"
                >
                  Show
                  <select
                    id="assessment-show"
                    value={historyFilter}
                    onChange={(event) => {
                      setHistoryFilter(event.currentTarget.value as HistoryFilter);
                      setPage(1);
                    }}
                    className="pixel-input mt-1 h-10 w-full px-3 text-sm md:h-9"
                  >
                    <option value="all">All students</option>
                    <option value="retakes">Retakes only (2+ attempts)</option>
                    <option value="low">
                      Latest score below {LOW_SCORE_BELOW}%
                    </option>
                  </select>
                </label>
              ) : null}
              <label
                htmlFor="assessment-sort"
                className="block text-xs font-medium sm:text-sm"
              >
                Sort by
                <select
                  id="assessment-sort"
                  value={
                    view === "attempts"
                      ? noteFilter !== ""
                        ? noteFilter
                        : sort
                      : historySort
                  }
                  onChange={(event) => {
                    const value = event.currentTarget.value;

                    if (view === "history") {
                      setHistorySort(value as HistorySort);
                    } else if (
                      MESSAGE_OPTIONS.some((option) => option.key === value)
                    ) {
                      // A message option filters the list (newest first).
                      setNoteFilter(value as NoteFilter);
                      setSort("newest");
                    } else {
                      setNoteFilter("");
                      setSort(value as SortKey);
                    }
                    setPage(1);
                  }}
                  className="pixel-input mt-1 h-10 w-full px-3 text-sm md:h-9"
                >
                  {view === "attempts" ? (
                    <>
                      {SORT_OPTIONS.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                      <optgroup label="Messages">
                        {MESSAGE_OPTIONS.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </optgroup>
                    </>
                  ) : (
                    HISTORY_SORT_OPTIONS.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))
                  )}
                </select>
              </label>
            </div>
          </PixelCard>

          <section aria-label="Answer summary">
            <StatGrid columns={3}>
              <StatCard label="Attempts" value={String(filtered.length)} />
              <StatCard
                label="Correct answers"
                value={totalSum > 0 ? `${correctSum}/${totalSum}` : "—"}
              />
              <StatCard label="Average score" value={`${average}%`} />
            </StatGrid>
          </section>

          {view === "history" ? (
            <HistoryTable
              rows={historyRows}
              page={validPage}
              totalPages={totalPages}
              onPageChange={setPage}
              onSelect={onSelect}
            />
          ) : (
          <PaginatedTable
            caption="Student attempts you can review"
            columns={[
              {
                key: "student",
                label: "Student",
                className: "whitespace-nowrap",
                render: (row) => (
                  <span className="block">
                    <span className="block font-semibold text-foreground">
                      {row.student}
                    </span>
                    {noteCounts[row.id] ? (
                      <span className="mt-1 block">
                        <FeedbackBadge
                          info={noteCounts[row.id]}
                          viewer="teacher"
                        />
                      </span>
                    ) : null}
                  </span>
                ),
              },
              {
                key: "quiz",
                label: "Quiz",
                render: (row) => row.quizTitle,
              },
              {
                key: "score",
                label: "Score",
                className: "whitespace-nowrap",
                render: (row) =>
                  formatRawScore(row.correct, row.total) ?? "—",
              },
              {
                key: "review",
                label: "Answers",
                className: "whitespace-nowrap",
                render: (row) => (
                  <PixelButton
                    type="button"
                    variant="primary"
                    size="sm"
                    className="whitespace-nowrap"
                    onClick={() => onSelect(row.id)}
                  >
                    Review
                  </PixelButton>
                ),
              },
              {
                key: "percentage",
                label: "Percentage",
                render: (row) => <PercentChip value={row.percentage} />,
              },
              {
                key: "completed",
                label: "Completed",
                className: "whitespace-nowrap",
                render: (row) => formatDate(row.completedAt),
              },
            ]}
            rows={rows}
            rowKey={(row) => row.id}
            page={validPage}
            totalPages={totalPages}
            onPageChange={setPage}
            emptyMessage="No attempts match your filters."
          />
          )}
          {view === "history" ? <HistoryGuide /> : null}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* History: every score a student got on each quiz                     */
/* ------------------------------------------------------------------ */

const CHIP_TONE = (percentage: number) =>
  percentage >= 75
    ? "bg-primary text-ink border-ink"
    : percentage >= 50
      ? "bg-accent text-ink border-ink"
      : "bg-danger-surface text-danger-dark border-danger-dark";

/** Boxes shown before the rest fold into "+N earlier". */
const VISIBLE_SCORES = 5;

/**
 * One box per attempt, oldest to newest. A long history folds the older boxes
 * into one button so a row never grows tall, however many retakes there are.
 */
function ScoreChips({
  row,
  onSelect,
}: {
  row: HistoryRow;
  onSelect: (attemptId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const folded = !expanded && row.scores.length > VISIBLE_SCORES;
  const shown = folded ? row.scores.slice(-VISIBLE_SCORES) : row.scores;
  const hiddenCount = row.scores.length - shown.length;

  return (
    <span className="flex flex-wrap items-center gap-1">
      {folded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label={`Show ${hiddenCount} earlier attempts`}
          className="border-2 border-dashed border-ink bg-surface px-1.5 py-0.5 text-xs font-bold whitespace-nowrap"
        >
          +{hiddenCount} earlier
        </button>
      ) : null}
      {shown.map((score) => (
        <button
          key={score.id}
          type="button"
          title={`Attempt ${score.attemptNumber} · ${formatDate(score.completedAt)} · open answers`}
          aria-label={`Attempt ${score.attemptNumber}: ${score.label}, ${formatDate(score.completedAt)}. Open answers`}
          onClick={() => onSelect(score.id)}
          className={`border-2 px-1.5 py-0.5 text-xs font-bold whitespace-nowrap ${CHIP_TONE(score.percentage)}`}
        >
          {score.label}
        </button>
      ))}
      {expanded && row.scores.length > VISIBLE_SCORES ? (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="px-1 text-xs font-bold underline"
        >
          Show fewer
        </button>
      ) : null}
    </span>
  );
}

function changeText(row: HistoryRow): string {
  if (row.change === null) return "Only one attempt";

  const since =
    row.earlierNotShown > 0
      ? `since attempt ${row.scores[0].attemptNumber}`
      : "since first";

  if (row.change === 0) return `No change ${since}`;

  return `${row.change > 0 ? "▲ +" : "▼ "}${row.change}% ${since}`;
}

function HistoryTable({
  rows,
  page,
  totalPages,
  onPageChange,
  onSelect,
}: {
  rows: HistoryRow[];
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSelect: (attemptId: string) => void;
}) {
  return (
    <PaginatedTable
      caption="Every score per student and quiz"
      columns={[
        {
          key: "student",
          label: "Student",
          className: "whitespace-nowrap",
          render: (row) => (
            <span className="font-semibold text-foreground">{row.student}</span>
          ),
        },
        {
          key: "quiz",
          label: "Quiz",
          render: (row) => row.quizTitle,
        },
        {
          key: "scores",
          label: "Scores (oldest → newest)",
          render: (row) => <ScoreChips row={row} onSelect={onSelect} />,
        },
        {
          key: "progress",
          label: "Progress",
          render: (row) => (
            <span className="block text-xs">
              <span className="block font-semibold text-foreground">
                {row.attemptsTaken === 1
                  ? "1 attempt"
                  : `${row.attemptsTaken} attempts`}{" "}
                · Best {row.best.label}
              </span>
              <span className="block text-neutral-600">{changeText(row)}</span>
              {row.earlierNotShown > 0 ? (
                <span className="block text-neutral-500">
                  Latest {row.scores.length} shown
                </span>
              ) : null}
            </span>
          ),
        },
      ]}
      rows={rows}
      rowKey={(row) => row.key}
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
      emptyMessage="No students match these filters."
    />
  );
}

/** Always visible under the history table: what the boxes and numbers mean. */
function HistoryGuide() {
  const swatch = (tone: string, label: string) => (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span
        aria-hidden="true"
        className={`inline-block h-3 w-3 border-2 ${tone}`}
      />
      {label}
    </span>
  );

  return (
    <section
      aria-label="How to read the history"
      className="space-y-1.5 border-2 border-ink bg-neutral-100 p-2.5 text-xs text-neutral-700 sm:text-sm"
    >
      <h4 className="text-sm font-bold text-foreground">How to read this</h4>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          Each box is one attempt, oldest on the left.{" "}
          <span className="inline-flex flex-wrap gap-x-2.5 gap-y-0.5 align-middle">
            {swatch("border-ink bg-primary", "75% or more")}
            {swatch("border-ink bg-accent", "50–74%")}
            {swatch(
              "border-danger-dark bg-danger-surface",
              "Below 50%",
            )}
          </span>
          . Select a box to open the answers for that attempt.
        </li>
        <li>
          <strong>Best</strong> is the highest score. <strong>Change</strong> is
          the latest score minus the first one, in percentage points.
        </li>
        <li>
          Students can retake a quiz as many times as you allow, so a long
          history shows the latest {VISIBLE_SCORES} boxes. Select “+N earlier”
          to see the rest. For each student and quiz, the dashboard keeps their
          latest {MAX_ATTEMPTS_PER_STUDENT_QUIZ} attempts; the row says when
          older ones are not shown.
        </li>
        <li>
          Use <strong>Show</strong> and <strong>Sort by</strong> to find
          retakes, students whose latest score is low, or who improved or
          dropped the most.
        </li>
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Review of one attempt                                               */
/* ------------------------------------------------------------------ */

const HIDE_ANSWERS_KEY = "fili:hide-answers-by-quiz";

/** Same quiz title, however it is capitalised or spaced. */
function quizKey(title: string | null | undefined): string {
  return (title ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Each quiz has its own setting. Quizzes without one have their answers
 * hidden. Stored on this device as { "<quiz title>": true | false }, where
 * false means the teacher chose to show the answers.
 */
function readHidePreferences(): Record<string, boolean> {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(HIDE_ANSWERS_KEY) ?? "{}",
    );

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }

    const result: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "boolean") result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

function saveHidePreferences(preferences: Record<string, boolean>): void {
  try {
    window.localStorage.setItem(HIDE_ANSWERS_KEY, JSON.stringify(preferences));
  } catch {
    /* the choice still works for this visit */
  }
}

type LoadState = {
  id: string;
  assessment?: Assessment;
  error?: string;
};

type Filter = "all" | AnswerStatus;

function errorText(
  body: unknown,
  fallback = "Unable to load your answers right now.",
): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "object" &&
    body.error !== null &&
    "message" in body.error &&
    typeof body.error.message === "string"
  ) {
    return body.error.message;
  }

  return fallback;
}

function AssessmentReview({
  viewer,
  attemptId,
  known,
  studentName,
  fallbackTitle,
  fallbackDate,
  onBack,
}: {
  viewer: Viewer;
  attemptId: string;
  /** The student's own history row, used for the header while loading. */
  known?: StudentHistoryRow;
  /** Teacher view: whose answers these are. */
  studentName?: string;
  fallbackTitle?: string;
  fallbackDate?: string;
  onBack: () => void;
}) {
  const [state, setState] = useState<LoadState | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  // Teachers can hide the answers on screen (for example when sharing the
  // screen). It only changes what is shown, not what is loaded.
  const [hidePreferences, setHidePreferences] = useState<
    Record<string, boolean>
  >(() => (viewer === "teacher" ? readHidePreferences() : {}));

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/assessment?attemptId=${encodeURIComponent(attemptId)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        let body: unknown = null;

        try {
          body = await response.json();
        } catch {
          body = null;
        }

        if (!response.ok) {
          throw new Error(errorText(body));
        }

        const assessment =
          typeof body === "object" && body !== null && "assessment" in body
            ? (body.assessment as Assessment)
            : null;

        if (!assessment) {
          throw new Error("Unable to load your answers right now.");
        }

        setState({ id: attemptId, assessment });

        // Opening the messages marks them as read, which clears the "new
        // message" notice on the dashboard. Fire and forget: a failure only
        // means the notice shows once more.
        if (assessment.feedback?.some((note) => !note.mine)) {
          void fetch("/api/assessment/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attemptId }),
          }).catch(() => undefined);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;

        setState({
          id: attemptId,
          error:
            error instanceof Error
              ? error.message
              : "Unable to load your answers right now.",
        });
      });

    return () => controller.abort();
  }, [attemptId]);

  const updateFeedback = useCallback(
    (change: (notes: AttemptFeedback[]) => AttemptFeedback[]) => {
      setState((previous) =>
        previous && previous.id === attemptId && previous.assessment
          ? {
              ...previous,
              assessment: {
                ...previous.assessment,
                feedback: change(previous.assessment.feedback),
              },
            }
          : previous,
      );
    },
    [attemptId],
  );

  const current = state?.id === attemptId ? state : null;
  const assessment = current?.assessment;
  const quizName =
    assessment?.attempt.quizTitle ?? known?.quiz_title ?? fallbackTitle ?? "";
  const settingKey = quizKey(quizName);
  // This quiz's own setting; answers are hidden until a teacher shows them.
  const hideAnswers =
    viewer === "teacher" && (hidePreferences[settingKey] ?? true);
  const subtitleParts = [
    studentName ? `Student: ${studentName}` : null,
    assessment
      ? `Attempt ${assessment.attempt.attemptNumber}`
      : known
        ? `Attempt ${known.attempt_number ?? "—"}`
        : null,
    assessment
      ? formatDate(assessment.attempt.completedAt)
      : known
        ? formatDate(known.completed_at)
        : fallbackDate
          ? formatDate(fallbackDate)
          : null,
  ].filter((part): part is string => part !== null);

  return (
    <div className="space-y-2 sm:space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="break-words text-xl font-bold text-foreground">
            {assessment?.attempt.quizTitle ??
              known?.quiz_title ??
              fallbackTitle ??
              "Assessment"}
          </h2>
          <p className="mt-1 text-sm text-px-muted">
            {subtitleParts.length > 0
              ? subtitleParts.join(" · ")
              : "Review your answers"}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {viewer === "teacher" && assessment ? (
            <PixelButton
              type="button"
              variant={hideAnswers ? "accent" : "neutral"}
              size="sm"
              aria-pressed={hideAnswers}
              title="Saved for this quiz only"
              onClick={() => {
                const next = { ...hidePreferences, [settingKey]: !hideAnswers };
                setHidePreferences(next);
                saveHidePreferences(next);
              }}
            >
              {hideAnswers ? "Show answers" : "Hide answers"}
            </PixelButton>
          ) : null}
          <PixelButton type="button" variant="neutral" size="sm" onClick={onBack}>
            ← Back to quizzes
          </PixelButton>
        </div>
      </div>

      {!current ? (
        <PixelCard>
          <p role="status" className="text-sm text-neutral-600">
            Loading your answers...
          </p>
        </PixelCard>
      ) : null}

      {current?.error ? (
        <div
          role="alert"
          className="border-2 border-danger-dark bg-danger-surface p-3 text-sm text-danger-dark"
        >
          {current.error}
        </div>
      ) : null}

      {assessment ? (
        <ReviewBody
          viewer={viewer}
          studentName={studentName}
          quizName={quizName}
          hideAnswers={hideAnswers}
          assessment={assessment}
          filter={filter}
          onFilterChange={setFilter}
          onFeedbackAdded={(note) =>
            updateFeedback((notes) => [...notes, note])
          }
          onFeedbackDeleted={(id) =>
            updateFeedback((notes) => notes.filter((note) => note.id !== id))
          }
        />
      ) : null}
    </div>
  );
}

function ReviewBody({
  viewer,
  studentName,
  quizName,
  hideAnswers,
  assessment,
  filter,
  onFilterChange,
  onFeedbackAdded,
  onFeedbackDeleted,
}: {
  viewer: Viewer;
  studentName?: string;
  quizName: string;
  hideAnswers: boolean;
  assessment: Assessment;
  filter: Filter;
  onFilterChange: (filter: Filter) => void;
  onFeedbackAdded: (note: AttemptFeedback) => void;
  onFeedbackDeleted: (id: string) => void;
}) {
  const { summary, questions } = assessment;
  const counts = {
    all: questions.length,
    wrong: questions.filter((q) => q.status === "wrong").length,
    correct: questions.filter((q) => q.status === "correct").length,
    skipped: questions.filter((q) => q.status === "skipped").length,
  };
  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: `All (${counts.all})` },
    { key: "wrong", label: `Wrong (${counts.wrong})` },
    { key: "correct", label: `Correct (${counts.correct})` },
    ...(counts.skipped > 0
      ? [{ key: "skipped" as const, label: `Skipped (${counts.skipped})` }]
      : []),
  ];
  // Right/wrong filters would give the answers away, so they go with them.
  const visible =
    hideAnswers || filter === "all"
      ? questions
      : questions.filter((q) => q.status === filter);

  const breakdown = {
    quiz: `Attempt ${assessment.attempt.attemptNumber}`,
    correct: summary.correct,
    wrong: summary.wrong,
    skipped: summary.skipped,
    total: summary.total,
  } as ComponentProps<typeof LatestBreakdown>["data"];

  return (
    <>
      <ChartCard
        title="Result summary"
        caption={
          viewer === "teacher"
            ? "The recorded score for this attempt"
            : "Your recorded score for this attempt"
        }
      >
        <LatestBreakdown data={breakdown} />
      </ChartCard>

      <FeedbackPanel
        attemptId={assessment.attempt.id}
        viewer={viewer}
        studentName={studentName}
        notes={assessment.feedback}
        onAdded={onFeedbackAdded}
        onDeleted={onFeedbackDeleted}
      />

      {!assessment.consistent ? (
        <p
          role="note"
          className="border-2 border-ink bg-neutral-100 p-2.5 text-xs text-neutral-700 sm:text-sm"
        >
          {viewer === "teacher"
            ? "The quiz may have been changed after this attempt, so the questions below might not match the score exactly. The score above is the one that was recorded."
            : "The quiz may have been changed after you took it, so the questions below might not match your score exactly. Your score above is the one that was recorded."}
        </p>
      ) : null}

      {hideAnswers ? (
        <p
          role="note"
          className="border-2 border-ink bg-neutral-100 p-2.5 text-xs text-neutral-700 sm:text-sm"
        >
          Answers are hidden for this quiz. Select “Show answers” to see the
          correct answers and what the student picked. This setting is saved
          for “{quizName}” only; your other quizzes keep their own.
        </p>
      ) : (
        <div
          role="group"
          aria-label="Show questions"
          className="flex flex-wrap gap-2"
        >
          {filters.map((option) => (
            <PixelButton
              key={option.key}
              type="button"
              size="sm"
              variant={filter === option.key ? "primary" : "neutral"}
              aria-pressed={filter === option.key}
              onClick={() => onFilterChange(option.key)}
            >
              {option.label}
            </PixelButton>
          ))}
        </div>
      )}

      {questions.length === 0 ? (
        <PixelCard>
          <p className="text-sm text-neutral-600">
            The questions for this quiz are no longer available.
          </p>
        </PixelCard>
      ) : visible.length === 0 ? (
        <PixelCard>
          <p className="text-sm text-neutral-600">
            No questions to show for this filter.
          </p>
        </PixelCard>
      ) : (
        <ol className="space-y-2 sm:space-y-3">
          {visible.map((question) => (
            <li key={question.id}>
              <QuestionCard
                question={question}
                viewer={viewer}
                hideAnswers={hideAnswers}
              />
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

const STATUS_BADGE: Record<
  AnswerStatus,
  { label: string; variant: "success" | "danger" | "warning" }
> = {
  correct: { label: "✓ Correct", variant: "success" },
  wrong: { label: "✗ Wrong", variant: "danger" },
  skipped: { label: "Skipped", variant: "warning" },
};

function choiceTag(choice: AssessmentChoice, viewer: Viewer): string | null {
  const picked = viewer === "teacher" ? "Student's answer" : "Your answer";

  if (choice.isCorrect && choice.isSelected) return `${picked} ✓`;
  if (choice.isCorrect) return "Correct answer";
  if (choice.isSelected) return `${picked} ✗`;
  return null;
}

function choiceClass(choice: AssessmentChoice): string {
  if (choice.isCorrect) return "border-ink bg-primary text-ink";
  if (choice.isSelected) {
    return "border-danger-dark bg-danger-surface text-danger-dark";
  }
  return "border-neutral-300 bg-surface text-foreground";
}

const NEUTRAL_CHOICE = "border-neutral-300 bg-surface text-foreground";

function QuestionCard({
  question,
  viewer,
  hideAnswers,
}: {
  question: AssessmentQuestion;
  viewer: Viewer;
  hideAnswers: boolean;
}) {
  const badge = STATUS_BADGE[question.status];
  const teacher = viewer === "teacher";

  return (
    <PixelCard as="article" className="p-2.5! sm:p-3!">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground sm:text-base">
          Question {question.number}
        </h3>
        {hideAnswers ? null : (
          <PixelBadge variant={badge.variant}>{badge.label}</PixelBadge>
        )}
      </div>

      <p className="mt-1 break-words text-sm text-foreground sm:text-base">
        {question.text}
      </p>

      {question.choices.length > 0 ? (
        <ul className="mt-2 space-y-1.5" aria-label="Answer choices">
          {question.choices.map((choice) => {
            const tag = hideAnswers ? null : choiceTag(choice, viewer);

            return (
              <li
                key={choice.key}
                className={`flex items-start gap-2 border-2 px-2 py-1.5 text-sm ${hideAnswers ? NEUTRAL_CHOICE : choiceClass(choice)}`}
              >
                <span
                  aria-hidden="true"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center border-2 border-ink bg-surface text-xs font-bold text-ink"
                >
                  {choice.key}
                </span>
                <span className="min-w-0 flex-1 break-words">
                  {choice.text}
                </span>
                {tag ? (
                  <span className="shrink-0 text-xs font-bold">{tag}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {!hideAnswers && question.status === "wrong" ? (
        <p className="mt-2 text-xs text-neutral-700 sm:text-sm">
          {teacher ? "Student's answer" : "Your answer"}:{" "}
          <strong>{question.yourAnswer}</strong>. Correct answer:{" "}
          <strong>{question.correctAnswer}</strong>.
        </p>
      ) : null}

      {!hideAnswers && question.status === "skipped" ? (
        <p className="mt-2 text-xs text-neutral-700 sm:text-sm">
          {teacher
            ? "The student did not answer this question."
            : "You did not answer this question."}{" "}
          Correct answer: <strong>{question.correctAnswer}</strong>.
        </p>
      ) : null}
    </PixelCard>
  );
}

/* ------------------------------------------------------------------ */
/* Teacher feedback: input box for teachers, read-only notes for students */
/* ------------------------------------------------------------------ */

const noteTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

function formatNoteTime(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "" : noteTimeFormatter.format(date);
}

function Spinner() {
  return (
    <span aria-hidden="true" className="pixel-spinner h-4 w-4 shrink-0">
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

function FeedbackPanel({
  attemptId,
  viewer,
  studentName,
  notes,
  onAdded,
  onDeleted,
}: {
  attemptId: string;
  viewer: Viewer;
  studentName?: string;
  notes: AttemptFeedback[];
  onAdded: (note: AttemptFeedback) => void;
  onDeleted: (id: string) => void;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  // Students start with a one-line prompt and open the box when they need it.
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const teacher = viewer === "teacher";
  const trimmed = message.trim();
  const who = studentName ?? "the student";

  async function send() {
    if (sending || trimmed === "") return;

    setSending(true);
    setError(null);

    try {
      const response = await fetch("/api/assessment/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, message: trimmed }),
      });
      const body: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          errorText(body, "Unable to send your message. Please try again."),
        );
      }

      const note =
        typeof body === "object" && body !== null && "feedback" in body
          ? (body.feedback as AttemptFeedback)
          : null;

      if (!note) {
        throw new Error("Unable to send your message. Please try again.");
      }

      onAdded(note);
      setMessage("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to send your message. Please try again.",
      );
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    setDeletingId(id);
    setError(null);

    try {
      const response = await fetch(
        `/api/assessment/feedback?feedbackId=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        throw new Error(
          errorText(body, "Unable to delete that message. Please try again."),
        );
      }

      onDeleted(id);
      setConfirmId(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to delete that message. Please try again.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  // Student with nothing written yet: one compact line instead of a big box.
  if (!teacher && notes.length === 0 && !open) {
    return (
      <PixelCard className="p-2.5! sm:p-3!">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-neutral-700 sm:text-sm">
            Questions about this score? Your teacher can read your message.
          </p>
          <PixelButton
            type="button"
            size="sm"
            variant="accent"
            className="whitespace-nowrap"
            onClick={() => setOpen(true)}
          >
            Ask your teacher
          </PixelButton>
        </div>
      </PixelCard>
    );
  }

  return (
    <PixelCard className="space-y-2 p-2.5! sm:space-y-3 sm:p-3!">
      <div>
        <h3 className="text-sm font-semibold text-foreground sm:text-base">
          {teacher ? "Feedback for this student" : "Messages with your teacher"}
        </h3>
        <p className="mt-0.5 text-xs text-neutral-600 sm:text-sm">
          {teacher
            ? `Use this when a score looks questionable or ${who} needs to clarify an answer. ${studentName ?? "The student"} can reply here.`
            : "Only you and your teacher can read these messages."}
        </p>
      </div>

      {notes.length > 0 ? (
        <ul className="space-y-1.5" aria-label="Messages">
          {notes.map((note) => (
            <li
              key={note.id}
              className={`border-2 border-ink p-2.5 text-sm ${
                note.authorRole === "teacher" ? "bg-neutral-100" : "bg-surface"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <span className="text-xs font-bold text-foreground">
                  {note.mine ? "You" : note.authorName}
                  {note.authorRole === "teacher" ? " (teacher)" : ""}
                  {formatNoteTime(note.createdAt)
                    ? ` · ${formatNoteTime(note.createdAt)}`
                    : ""}
                </span>

                {note.mine ? (
                  confirmId === note.id ? (
                    <span className="flex items-center gap-1.5">
                      <PixelButton
                        type="button"
                        size="sm"
                        variant="danger"
                        disabled={deletingId !== null}
                        aria-busy={deletingId === note.id}
                        onClick={() => void remove(note.id)}
                        className="whitespace-nowrap"
                      >
                        {deletingId === note.id ? <Spinner /> : null}
                        <span>
                          {deletingId === note.id ? "Deleting..." : "Yes, delete"}
                        </span>
                      </PixelButton>
                      <PixelButton
                        type="button"
                        size="sm"
                        variant="neutral"
                        disabled={deletingId !== null}
                        onClick={() => setConfirmId(null)}
                      >
                        Keep
                      </PixelButton>
                    </span>
                  ) : (
                    <PixelButton
                      type="button"
                      size="sm"
                      variant="neutral"
                      onClick={() => setConfirmId(note.id)}
                    >
                      Delete
                    </PixelButton>
                  )
                ) : null}
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-foreground">
                {note.message}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <form
        className="space-y-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label
          htmlFor="feedback-message"
          className="block text-xs font-medium sm:text-sm"
        >
          {teacher
            ? notes.length > 0
              ? "Add another note"
              : "Write a note"
            : notes.length > 0
              ? "Your reply"
              : "Your question or message"}
          <textarea
            id="feedback-message"
            value={message}
            rows={teacher ? 3 : 2}
            maxLength={FEEDBACK_MAX_LENGTH}
            disabled={sending}
            placeholder={
              teacher
                ? "e.g. Please see me about question 4. Your answer looks different from what we discussed in class."
                : "e.g. I think my answer to question 3 was right because..."
            }
            onChange={(event) => setMessage(event.currentTarget.value)}
            className="pixel-input mt-1 block w-full resize-y px-3 py-2 text-sm"
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className={`text-xs ${
              message.length >= FEEDBACK_MAX_LENGTH
                ? "font-bold text-danger-dark"
                : "text-neutral-500"
            }`}
          >
            {message.length}/{FEEDBACK_MAX_LENGTH}
          </span>
          <span className="flex items-center gap-1.5">
            {!teacher && notes.length === 0 ? (
              <PixelButton
                type="button"
                size="sm"
                variant="neutral"
                disabled={sending}
                onClick={() => {
                  setOpen(false);
                  setMessage("");
                  setError(null);
                }}
              >
                Cancel
              </PixelButton>
            ) : null}
            <PixelButton
              type="submit"
              size="sm"
              variant="primary"
              disabled={sending || trimmed === ""}
              aria-busy={sending}
              className="whitespace-nowrap"
            >
              {sending ? <Spinner /> : null}
              <span>
                {sending ? "Sending..." : teacher ? "Send feedback" : "Send"}
              </span>
            </PixelButton>
          </span>
        </div>
      </form>

      {error ? (
        <p
          role="alert"
          className="border-2 border-danger-dark bg-danger-surface p-2 text-xs text-danger-dark sm:text-sm"
        >
          {error}
        </p>
      ) : null}
    </PixelCard>
  );
}
