import { getEntityConfig } from "./config";
import { SearchError } from "./errors";
import {
  buildSearchPlan,
  hasTeacherScope,
} from "./query-builder";
import type {
  ParticipantSearchItem,
  QuizSearchItem,
  SearchEntity,
  SearchItem,
  SearchQuery,
  SearchRepository,
  SearchResponse,
  SearchRow,
  SearchScope,
  StudentSearchItem,
  TeacherSearchItem,
} from "./types";

function textValue(row: SearchRow, key: string): string {
  const value = row[key];

  if (typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function numberValue(
  row: SearchRow,
  key: string,
  fallback = 0,
): number {
  const value = row[key];

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function nullableNumberValue(
  row: SearchRow,
  key: string,
): number | null {
  const value = row[key];

  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

export function mapSearchItem(
  entity: SearchEntity,
  row: SearchRow,
): SearchItem {
  if (entity === "students") {
    const item: StudentSearchItem = {
      entity: "students",
      id: textValue(row, "student_id"),
      username: textValue(row, "username"),
      email: textValue(row, "email"),
      teacherId: textValue(row, "teacher_id"),
      teacherUsername: textValue(row, "teacher_username"),
      createdAt: textValue(row, "created_at"),
    };

    return item;
  }

  if (entity === "quizzes") {
    const item: QuizSearchItem = {
      entity: "quizzes",
      id: textValue(row, "quiz_id"),
      title: textValue(row, "title"),
      status: textValue(row, "status"),
      questionCount: numberValue(row, "question_count"),
      teacherId: textValue(row, "teacher_id"),
      teacherUsername: textValue(row, "teacher_username"),
      createdAt: textValue(row, "created_at"),
    };

    return item;
  }

  if (entity === "participants") {
    const item: ParticipantSearchItem = {
      entity: "participants",
      id: textValue(row, "participant_id"),
      username: textValue(row, "username"),
      status: textValue(row, "status"),
      score: nullableNumberValue(row, "score"),
      quizId: textValue(row, "quiz_id"),
      quizTitle: textValue(row, "quiz_title"),
      sessionId: textValue(row, "session_id"),
      sessionCode: textValue(row, "session_code"),
      studentEmail: textValue(row, "student_email"),
      teacherId: textValue(row, "teacher_id"),
      teacherUsername: textValue(row, "teacher_username"),
      joinedAt: textValue(row, "joined_at"),
    };

    return item;
  }

  const item: TeacherSearchItem = {
    entity: "teachers",
    id: textValue(row, "teacher_id"),
    username: textValue(row, "username"),
    email: textValue(row, "email"),
    status: textValue(row, "status"),
    quizCount: numberValue(row, "quiz_count"),
    createdAt: textValue(row, "created_at"),
  };

  return item;
}

export async function executeSearch(input: {
  context: SearchScope;
  query: SearchQuery;
  repository: SearchRepository;
}): Promise<SearchResponse> {
  const plan = buildSearchPlan(input.query, input.context);

  if (!hasTeacherScope(plan, input.context)) {
    throw new SearchError(
      500,
      "SCOPE_INVARIANT_FAILED",
      "Search was stopped because its permission scope was invalid.",
    );
  }

  const { rows, total } = await input.repository.search(plan);
  const config = getEntityConfig(input.query.entity);
  const totalPages = Math.max(
    1,
    Math.ceil(total / input.query.pageSize),
  );

  return {
    items: rows.map((row) => mapSearchItem(input.query.entity, row)),
    pagination: {
      page: input.query.page,
      pageSize: input.query.pageSize,
      total,
      totalPages,
    },
    meta: {
      entity: input.query.entity,
      role: input.context.role,
      scope:
        input.context.role === "teacher"
          ? "own-records"
          : "all-records",
      dataSource: input.repository.dataSource,
      filters: {
        q: input.query.q,
        status: input.query.status,
        teacher: input.query.teacher,
        quiz: input.query.quiz,
        session: input.query.session,
        from: input.query.from,
        to: input.query.to,
      },
      sort: input.query.sort,
      dir: input.query.dir,
      searchableFields: [...config.searchableFields],
    },
  };
}
