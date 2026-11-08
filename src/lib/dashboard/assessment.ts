// lib/dashboard/assessment.ts
// Pure helpers: turn the JSON from public.student_assessment() into a review
// of one finished quiz attempt (every question, its choices, the correct
// answer and what the student picked).
//
// The headline numbers always come from the recorded result (quiz_results), so
// they match every other statistic in the app. The per-question marks are
// worked out from the saved answers and checked against that record; if they
// disagree (for example the teacher edited the quiz afterwards), `consistent`
// is false and the screen says so instead of silently showing different totals.

export type AnswerStatus = "correct" | "wrong" | "skipped";

export type AssessmentChoice = {
  /** Display letter: A, B, C... */
  key: string;
  text: string;
  isCorrect: boolean;
  isSelected: boolean;
};

export type AssessmentQuestion = {
  number: number;
  id: string;
  text: string;
  status: AnswerStatus;
  choices: AssessmentChoice[];
  /** The student's answer as text, or null when the question was skipped. */
  yourAnswer: string | null;
  correctAnswer: string;
};

export type FeedbackRole = "teacher" | "student";

/** One message on an attempt: a teacher note or a student reply/question. */
export type AttemptFeedback = {
  id: string;
  message: string;
  authorRole: FeedbackRole;
  authorName: string;
  createdAt: string;
  /** True when the signed-in user wrote it (authors can delete their own). */
  mine: boolean;
};

/** Per attempt: how many messages, and who wrote the latest one. */
export type FeedbackCount = { count: number; lastRole: FeedbackRole };

export const FEEDBACK_MAX_LENGTH = 500;

export type Assessment = {
  attempt: {
    id: string;
    quizTitle: string;
    attemptNumber: number;
    completedAt: string;
    percentage: number;
  };
  /** Recorded result: the same numbers the rest of the dashboard shows. */
  summary: {
    correct: number;
    wrong: number;
    skipped: number;
    total: number;
  };
  questions: AssessmentQuestion[];
  /** True when the question marks add up to the recorded result. */
  consistent: boolean;
  /** Messages between teacher and student, oldest first. */
  feedback: AttemptFeedback[];
};

type RawChoice = { text: string; matchKeys: string[] };

type RawQuestion = {
  id: string;
  text: string;
  choices: RawChoice[];
  correctAnswer: string;
  userAnswer: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function readInt(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function firstText(
  record: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const found = readText(record[key]);
    if (found !== null) return found;
  }
  return null;
}

const letterFor = (index: number) =>
  index < 26 ? String.fromCharCode(65 + index) : String(index + 1);

const normalize = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

/** "A. Manila" / "b) Cebu" -> "Manila" / "Cebu" */
const stripLabel = (value: string) =>
  normalize(value.replace(/^\s*[A-Za-z0-9][.)]\s+/, ""));

/**
 * quiz_questions.choices is jsonb. Accept the usual shapes: ["a", "b"],
 * [{text: "a"}], {"A": "a", "B": "b"} (also as a JSON string).
 */
function parseChoices(raw: unknown): RawChoice[] {
  let value = raw;

  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (isRecord(item)) {
        const text =
          firstText(item, [
            "text",
            "choice",
            "label",
            "value",
            "answer",
            "option",
          ]) ?? "";
        const key = firstText(item, ["key", "id", "letter", "index"]);

        return {
          text,
          matchKeys: [key, letterFor(index)]
            .filter((entry): entry is string => entry !== null)
            .map(normalize),
        };
      }

      return {
        text: readText(item) ?? "",
        matchKeys: [normalize(letterFor(index))],
      };
    });
  }

  if (isRecord(value)) {
    return Object.entries(value).map(([key, item], index) => ({
      text: readText(item) ?? "",
      matchKeys: [normalize(key), normalize(letterFor(index))],
    }));
  }

  return [];
}

/**
 * Which choice does a saved answer point to? The app may store the choice
 * text, its letter (A/B/C) or its position (0-based or 1-based). Returns -1
 * when nothing matches.
 */
function resolveChoice(
  value: string | null,
  choices: readonly RawChoice[],
  base: 0 | 1,
): number {
  if (value === null || value.trim() === "") return -1;

  const wanted = normalize(value);

  const byText = choices.findIndex((choice) => normalize(choice.text) === wanted);
  if (byText >= 0) return byText;

  const byKey = choices.findIndex((choice) =>
    choice.matchKeys.includes(wanted.replace(/[.)]$/, "")),
  );
  if (byKey >= 0) return byKey;

  const wantedLabel = stripLabel(value);
  const byLabel = choices.findIndex(
    (choice) => stripLabel(choice.text) === wantedLabel,
  );
  if (byLabel >= 0) return byLabel;

  if (/^\d+$/.test(wanted)) {
    const position = Number(wanted) - base;
    if (position >= 0 && position < choices.length) return position;
  }

  return -1;
}

function gradeQuestions(
  rawQuestions: readonly RawQuestion[],
  base: 0 | 1,
): { questions: AssessmentQuestion[]; correct: number; answered: number } {
  let correct = 0;
  let answered = 0;

  const questions = rawQuestions.map((raw, index): AssessmentQuestion => {
    const correctIndex = resolveChoice(raw.correctAnswer, raw.choices, base);
    const userIndex = resolveChoice(raw.userAnswer, raw.choices, base);
    const hasAnswer = raw.userAnswer !== null && raw.userAnswer.trim() !== "";

    let status: AnswerStatus;
    if (!hasAnswer) {
      status = "skipped";
    } else {
      answered += 1;
      const isRight =
        correctIndex >= 0 && userIndex >= 0
          ? correctIndex === userIndex
          : normalize(raw.userAnswer ?? "") === normalize(raw.correctAnswer);
      status = isRight ? "correct" : "wrong";
      if (isRight) correct += 1;
    }

    return {
      number: index + 1,
      id: raw.id,
      text: raw.text,
      status,
      choices: raw.choices.map((choice, choiceIndex) => ({
        key: letterFor(choiceIndex),
        text: choice.text,
        isCorrect: choiceIndex === correctIndex,
        isSelected: choiceIndex === userIndex,
      })),
      yourAnswer: hasAnswer
        ? userIndex >= 0
          ? raw.choices[userIndex].text
          : (raw.userAnswer ?? null)
        : null,
      correctAnswer:
        correctIndex >= 0 ? raw.choices[correctIndex].text : raw.correctAnswer,
    };
  });

  return { questions, correct, answered };
}

/**
 * When answers are stored as numbers, look for evidence of the numbering: a
 * "0" means 0-based; a number equal to the choice count means 1-based (it
 * would be out of range otherwise). Defaults to 0-based.
 */
function guessBase(questions: readonly RawQuestion[]): 0 | 1 {
  let sawZero = false;
  let sawLast = false;

  for (const question of questions) {
    for (const value of [question.correctAnswer, question.userAnswer]) {
      if (value === null || !/^\d+$/.test(value.trim())) continue;

      const number = Number(value);
      if (number === 0) sawZero = true;
      if (number > 0 && number === question.choices.length) sawLast = true;
    }
  }

  return sawLast && !sawZero ? 1 : 0;
}

/** One note from the database (also the shape add_attempt_feedback returns). */
export function parseFeedbackItem(item: unknown): AttemptFeedback | null {
  if (!isRecord(item)) return null;

  const id = readText(item.id);
  const message = readText(item.message);
  if (!id || !message || message.trim() === "") return null;

  const authorRole: FeedbackRole =
    item.author_role === "student" ? "student" : "teacher";

  return {
    id,
    message,
    authorRole,
    authorName:
      readText(item.author_name) ??
      (authorRole === "student" ? "Student" : "Teacher"),
    createdAt: readText(item.created_at) ?? "",
    mine: item.mine === true,
  };
}

function parseFeedback(raw: unknown): AttemptFeedback[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map(parseFeedbackItem)
    .filter((entry): entry is AttemptFeedback => entry !== null);
}

/** attempt id -> message count and last author, from attempt_feedback_counts(). */
export function parseFeedbackCounts(
  raw: unknown,
): Record<string, FeedbackCount> {
  if (!isRecord(raw)) return {};

  const counts: Record<string, FeedbackCount> = {};
  for (const [attemptId, value] of Object.entries(raw)) {
    if (!isRecord(value)) continue;

    const count = readInt(value.count);
    if (count > 0) {
      counts[attemptId] = {
        count,
        lastRole: value.last === "student" ? "student" : "teacher",
      };
    }
  }
  return counts;
}

/** Returns null when the payload is not an attempt review. */
export function buildAssessment(payload: unknown): Assessment | null {
  if (!isRecord(payload) || !isRecord(payload.attempt)) return null;
  if (!Array.isArray(payload.questions)) return null;

  const attempt = payload.attempt;
  const id = readText(attempt.attempt_id);
  if (!id) return null;

  const total = readInt(attempt.total_questions);
  const recordedCorrect = readInt(attempt.correct_count);
  const recordedAnswered = Math.min(
    readInt(attempt.answered_count, recordedCorrect),
    total,
  );

  const rawQuestions: RawQuestion[] = payload.questions
    .filter(isRecord)
    .map((item, index) => ({
      id: readText(item.question_id) ?? String(index + 1),
      text: readText(item.question_text) ?? "",
      choices: parseChoices(item.choices),
      correctAnswer: readText(item.correct_answer) ?? "",
      userAnswer: readText(item.user_answer),
    }));

  // Positions can be stored 0-based or 1-based. Start from what the data
  // suggests, and switch only if the other reading reproduces the recorded
  // score and this one does not.
  const hint = guessBase(rawQuestions);
  const preferred = gradeQuestions(rawQuestions, hint);
  const other = gradeQuestions(rawQuestions, hint === 0 ? 1 : 0);
  const graded =
    preferred.correct === recordedCorrect || other.correct !== recordedCorrect
      ? preferred
      : other;

  const consistent =
    graded.correct === recordedCorrect &&
    graded.answered === recordedAnswered &&
    graded.questions.length === total;

  return {
    attempt: {
      id,
      quizTitle: readText(attempt.quiz_title) ?? "Untitled quiz",
      attemptNumber: readInt(attempt.attempt_number, 1),
      completedAt: readText(attempt.completed_at) ?? "",
      percentage: Number(attempt.percentage) || 0,
    },
    summary: {
      correct: recordedCorrect,
      wrong: Math.max(recordedAnswered - recordedCorrect, 0),
      skipped: Math.max(total - recordedAnswered, 0),
      total,
    },
    questions: graded.questions,
    consistent,
    feedback: parseFeedback(payload.feedback),
  };
}
