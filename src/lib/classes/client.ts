/**
 * Browser-side calls to the website's own `/api/classes` routes, which forward
 * to the quiz backend. Every function throws an Error whose message is safe to
 * show to the teacher.
 */

export type ClassStudent = { userId: string; username: string };

export type TeacherClass = {
  classId: string;
  name: string;
  createdAt: string | null;
  students: ClassStudent[];
};

export type StudentSuggestion = ClassStudent & { source: string };

/** Where one of the teacher's quizzes was sent. */
export type QuizAssignment = {
  sessionId: string;
  classIds: string[];
  students: ClassStudent[];
};

/** A published quiz sent to the signed-in student. */
export type AssignedQuiz = {
  sessionId: string;
  title: string;
  gameMode: string;
  teacherUsername: string;
  totalQuestions: number;
  isTimeAttack: boolean;
  timeAttackSeconds: number;
  maxAttempts: number | null;
  attemptsUsed: number;
  attemptsRemaining: number | null;
  completed: boolean;
  expiresAt: string | null;
  isExpired: boolean;
  assignedAt: string | null;
};

export const MAX_CLASS_NAME = 40;

const FALLBACK_MESSAGE = "Something went wrong. Please retry.";

function messageFrom(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("error" in body)) {
    return null;
  }

  const error = (body as { error: unknown }).error;
  if (typeof error === "string") return error;

  if (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return null;
}

async function request(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new Error("Could not reach the server. Check your connection.");
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(messageFrom(payload) ?? FALLBACK_MESSAGE);
  }

  return payload;
}

function asStudents(value: unknown): ClassStudent[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (
      typeof item === "object" &&
      item !== null &&
      typeof (item as ClassStudent).userId === "string" &&
      typeof (item as ClassStudent).username === "string"
    ) {
      const { userId, username } = item as ClassStudent;
      return [{ userId, username }];
    }
    return [];
  });
}

export function parseClasses(payload: unknown): TeacherClass[] {
  const rows =
    typeof payload === "object" && payload !== null
      ? (payload as { classes?: unknown }).classes
      : null;
  if (!Array.isArray(rows)) return [];

  return rows.flatMap((row) => {
    if (
      typeof row !== "object" ||
      row === null ||
      typeof (row as TeacherClass).classId !== "string" ||
      typeof (row as TeacherClass).name !== "string"
    ) {
      return [];
    }

    const item = row as TeacherClass & { students?: unknown };
    return [
      {
        classId: item.classId,
        name: item.name,
        createdAt: typeof item.createdAt === "string" ? item.createdAt : null,
        students: asStudents(item.students),
      },
    ];
  });
}

function rowsOf(payload: unknown, key: string): Record<string, unknown>[] {
  const rows =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)[key]
      : null;

  return Array.isArray(rows)
    ? rows.filter(
        (row): row is Record<string, unknown> =>
          typeof row === "object" && row !== null,
      )
    : [];
}

const text = (value: unknown): string => (typeof value === "string" ? value : "");
const count = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;
const maybeCount = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export function parseAssignments(payload: unknown): QuizAssignment[] {
  return rowsOf(payload, "assignments").flatMap((row) => {
    const sessionId = text(row.sessionId);
    if (!sessionId) return [];

    return [
      {
        sessionId,
        classIds: Array.isArray(row.classIds)
          ? row.classIds.filter((id): id is string => typeof id === "string")
          : [],
        students: asStudents(row.students),
      },
    ];
  });
}

export function parseAssignedQuizzes(payload: unknown): AssignedQuiz[] {
  return rowsOf(payload, "quizzes").flatMap((row) => {
    const sessionId = text(row.sessionId);
    if (!sessionId) return [];

    return [
      {
        sessionId,
        title: text(row.title) || "Untitled quiz",
        gameMode: text(row.gameMode),
        teacherUsername: text(row.teacherUsername),
        totalQuestions: count(row.totalQuestions),
        isTimeAttack: row.isTimeAttack === true,
        timeAttackSeconds: count(row.timeAttackSeconds),
        maxAttempts: maybeCount(row.maxAttempts),
        attemptsUsed: count(row.attemptsUsed),
        attemptsRemaining: maybeCount(row.attemptsRemaining),
        completed: row.completed === true,
        // The backend names this one field in snake_case.
        expiresAt: text(row.expires_at) || null,
        isExpired: row.isExpired === true,
        assignedAt: text(row.assignedAt) || null,
      },
    ];
  });
}

export async function listClasses(): Promise<TeacherClass[]> {
  return parseClasses(await request("/api/classes", "GET"));
}

export async function listSuggestions(): Promise<StudentSuggestion[]> {
  const payload = await request("/api/classes/suggestions", "GET");
  const rows =
    typeof payload === "object" && payload !== null
      ? (payload as { students?: unknown }).students
      : null;
  if (!Array.isArray(rows)) return [];

  return rows.flatMap((row) => {
    const [student] = asStudents([row]);
    if (!student) return [];
    const source = (row as { source?: unknown }).source;
    return [{ ...student, source: typeof source === "string" ? source : "managed" }];
  });
}

export async function createClass(name: string): Promise<void> {
  await request("/api/classes", "POST", { name });
}

export async function renameClass(
  classId: string,
  name: string,
): Promise<void> {
  await request(`/api/classes/${encodeURIComponent(classId)}`, "PATCH", { name });
}

export async function deleteClass(classId: string): Promise<void> {
  await request(`/api/classes/${encodeURIComponent(classId)}`, "DELETE");
}

export async function addStudents(
  classId: string,
  usernames: string[],
): Promise<number> {
  const payload = await request(
    `/api/classes/${encodeURIComponent(classId)}/students`,
    "POST",
    { usernames },
  );
  const added =
    typeof payload === "object" && payload !== null
      ? (payload as { added?: unknown }).added
      : 0;

  return typeof added === "number" ? added : 0;
}

export async function removeStudent(
  classId: string,
  studentId: string,
): Promise<void> {
  await request(
    `/api/classes/${encodeURIComponent(classId)}/students/${encodeURIComponent(studentId)}`,
    "DELETE",
  );
}

/** Splits typed usernames on commas, spaces and new lines; drops repeats. */
export function parseUsernames(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const part of text.split(/[\s,;]+/)) {
    const name = part.trim();
    const key = name.toLowerCase();
    if (name && !seen.has(key)) {
      seen.add(key);
      result.push(name);
    }
  }

  return result;
}
