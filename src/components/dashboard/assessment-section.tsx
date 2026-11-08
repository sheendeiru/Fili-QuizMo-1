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

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/assessment/feedback", {
      signal: controller.signal,
      cache: "no-store",
    })
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

    return () => controller.abort();
  }, []);

  return counts;
}

type NoteFilter = "" | "replied" | "with" | "without";

type SortKey = "newest" | "highest" | "lowest" | "name";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest first" },
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
      (noteFilter === "" ||
        (noteFilter === "replied"
          ? noteCounts[attempt.id]?.lastRole === "student"
          : (noteFilter === "with") === Boolean(noteCounts[attempt.id]))),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const validPage = Math.min(page, totalPages);
  const rows = sortAttempts(filtered, sort).slice(
    (validPage - 1) * PAGE_SIZE,
    validPage * PAGE_SIZE,
  );

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
      <section>
        <h2 className="text-xl font-bold text-foreground">Assessment</h2>
        <p className="mt-1 text-sm text-px-muted">
          Review each student&apos;s answers: the choices, the correct answer,
          and where they went wrong.
        </p>
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
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
              <label
                htmlFor="assessment-notes"
                className="block text-xs font-medium sm:text-sm"
              >
                Messages
                <select
                  id="assessment-notes"
                  value={noteFilter}
                  onChange={(event) => {
                    setNoteFilter(event.currentTarget.value as NoteFilter);
                    setPage(1);
                  }}
                  className="pixel-input mt-1 h-10 w-full px-3 text-sm md:h-9"
                >
                  <option value="">All attempts</option>
                  <option value="replied">Student replied</option>
                  <option value="without">No messages yet</option>
                  <option value="with">Has messages</option>
                </select>
              </label>
              <label
                htmlFor="assessment-sort"
                className="block text-xs font-medium sm:text-sm"
              >
                Sort by
                <select
                  id="assessment-sort"
                  value={sort}
                  onChange={(event) => {
                    setSort(event.currentTarget.value as SortKey);
                    setPage(1);
                  }}
                  className="pixel-input mt-1 h-10 w-full px-3 text-sm md:h-9"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
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
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Review of one attempt                                               */
/* ------------------------------------------------------------------ */

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
        <PixelButton type="button" variant="neutral" size="sm" onClick={onBack}>
          ← Back to quizzes
        </PixelButton>
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
  assessment,
  filter,
  onFilterChange,
  onFeedbackAdded,
  onFeedbackDeleted,
}: {
  viewer: Viewer;
  studentName?: string;
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
  const visible =
    filter === "all" ? questions : questions.filter((q) => q.status === filter);

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
              <QuestionCard question={question} viewer={viewer} />
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

function QuestionCard({
  question,
  viewer,
}: {
  question: AssessmentQuestion;
  viewer: Viewer;
}) {
  const badge = STATUS_BADGE[question.status];
  const teacher = viewer === "teacher";

  return (
    <PixelCard as="article" className="p-2.5! sm:p-3!">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground sm:text-base">
          Question {question.number}
        </h3>
        <PixelBadge variant={badge.variant}>{badge.label}</PixelBadge>
      </div>

      <p className="mt-1 break-words text-sm text-foreground sm:text-base">
        {question.text}
      </p>

      {question.choices.length > 0 ? (
        <ul className="mt-2 space-y-1.5" aria-label="Answer choices">
          {question.choices.map((choice) => {
            const tag = choiceTag(choice, viewer);

            return (
              <li
                key={choice.key}
                className={`flex items-start gap-2 border-2 px-2 py-1.5 text-sm ${choiceClass(choice)}`}
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

      {question.status === "wrong" ? (
        <p className="mt-2 text-xs text-neutral-700 sm:text-sm">
          {teacher ? "Student's answer" : "Your answer"}:{" "}
          <strong>{question.yourAnswer}</strong>. Correct answer:{" "}
          <strong>{question.correctAnswer}</strong>.
        </p>
      ) : null}

      {question.status === "skipped" ? (
        <p className="mt-2 text-xs text-neutral-700 sm:text-sm">
          {teacher
            ? "The student did not answer this question."
            : "You did not answer this question."}{" "}
          Correct answer:{" "}
          <strong>{question.correctAnswer}</strong>.
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
