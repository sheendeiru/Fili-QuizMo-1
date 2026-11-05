import type {
  SearchEntity,
  SearchFilterKey,
  SearchRole,
  SearchSortField,
} from "./types";

export type SearchStatusOption = {
  value: string;
  label: string;
};

export type SearchFilterDefinition = {
  label: string;
  type: "select" | "text" | "date";
  roles?: readonly SearchRole[];
  entities?: readonly SearchEntity[];
  maxLength?: number;
  placeholder?: string;
};

export type SearchEntityConfig = {
  label: string;
  pluralLabel: string;
  description: string;
  searchPlaceholder: string;
  searchHint: string;
  view: string;
  idColumn: string;
  scopeColumn: string;
  dateColumn: string;
  statusColumn: string | null;
  statusLabel: string;
  statusOptions: readonly SearchStatusOption[];
  searchColumns: readonly string[];
  searchableFields: readonly string[];
  sortColumns: Record<SearchSortField, string>;
  sortFields: readonly SearchSortField[];
  select: readonly string[];
  filters: readonly SearchFilterKey[];
};

export const DEFAULT_PAGE_SIZE = 5;
export const MAX_PAGE_SIZE = 5;
export const MAX_SEARCH_LENGTH = 200;

export const SORT_OPTIONS: readonly {
  value: SearchSortField;
  label: string;
}[] = [
  { value: "name", label: "Name" },
  { value: "date", label: "Date" },
  { value: "status", label: "Status" },
];

export const FILTER_DEFINITIONS: Record<
  SearchFilterKey,
  SearchFilterDefinition
> = {
  status: {
    label: "Status",
    type: "select",
  },
  teacher: {
    label: "Teacher username",
    type: "text",
    roles: ["admin"],
    entities: ["students", "student_accounts", "quizzes"],
    maxLength: 100,
    placeholder: "e.g. msantos",
  },
  quiz: {
    label: "Quiz title",
    type: "text",
    entities: ["students"],
    maxLength: 200,
    placeholder: "e.g. Science Fundamentals",
  },
  session: {
    label: "Session code",
    type: "text",
    entities: ["students"],
    maxLength: 100,
    placeholder: "e.g. FMBFE4",
  },
  from: {
    label: "From date",
    type: "date",
  },
  to: {
    label: "To date",
    type: "date",
  },
};

export const entityConfigs: Record<SearchEntity, SearchEntityConfig> = {
  quizzes: {
    label: "Quiz",
    pluralLabel: "Quizzes",
    description:
      "Search quizzes by title or status, and narrow results by teacher or date.",
    searchPlaceholder: "Search quiz title or status",
    searchHint:
      "Searches quiz titles and status. Teacher filters are available to admins.",
    view: "search_quizzes",
    idColumn: "quiz_id",
    scopeColumn: "teacher_id",
    dateColumn: "created_at",
    statusColumn: "status",
    statusLabel: "Quiz status",
    statusOptions: [
      { value: "draft", label: "Draft" },
      { value: "ready", label: "Ready" },
      { value: "failed", label: "Failed" },
    ],
    searchColumns: ["title", "status"],
    searchableFields: ["Quiz title", "Status"],
    sortColumns: {
      name: "title",
      date: "created_at",
      status: "status",
    },
    sortFields: ["name", "date", "status"],
    select: [
      "quiz_id",
      "teacher_id",
      "teacher_username",
      "title",
      "status",
      "question_count",
      "created_at",
    ],
    filters: ["status", "teacher", "from", "to"],
  },
  students: {
    label: "Student",
    pluralLabel: "Students",
    description:
      "Search student usernames, quiz titles, status, session code, or email.",
    searchPlaceholder: "Search username, quiz, session, or email",
    searchHint:
      "Searches student username, status, quiz title, session code, and email. Session and quiz filters are also available.",
    view: "search_participants",
    idColumn: "participant_id",
    scopeColumn: "teacher_id",
    dateColumn: "joined_at",
    statusColumn: "status",
    statusLabel: "Student status",
    statusOptions: [
      { value: "not_started", label: "Not started" },
      { value: "in_progress", label: "In progress" },
      { value: "completed", label: "Completed" },
    ],
    searchColumns: [
      "username",
      "status",
      "quiz_title",
      "session_code",
      "student_email",
    ],
    searchableFields: [
      "Student username",
      "Student status",
      "Quiz title",
      "Session code",
      "Email",
    ],
    sortColumns: {
      name: "username",
      date: "joined_at",
      status: "status",
    },
    sortFields: ["name", "date", "status"],
    select: [
      "participant_id",
      "session_id",
      "session_code",
      "quiz_id",
      "quiz_title",
      "username",
      "status",
      "score",
      "joined_at",
      "student_email",
      "teacher_id",
      "teacher_username",
    ],
    filters: ["status", "teacher", "quiz", "session", "from", "to"],
  },
  student_accounts: {
    label: "Student account",
    pluralLabel: "Student accounts",
    description:
      "Search student accounts by username or email, and narrow results by managing teacher or date.",
    searchPlaceholder: "Search username, email, or teacher",
    searchHint:
      "Searches student account usernames, emails, and managing teachers. Passwords are never searchable.",
    view: "search_students",
    idColumn: "student_id",
    scopeColumn: "teacher_id",
    dateColumn: "created_at",
    statusColumn: null,
    statusLabel: "Status",
    statusOptions: [],
    searchColumns: ["username", "email", "teacher_username"],
    searchableFields: ["Username", "Email", "Teacher"],
    sortColumns: {
      name: "username",
      date: "created_at",
      status: "username",
    },
    sortFields: ["name", "date"],
    select: [
      "student_id",
      "teacher_id",
      "teacher_username",
      "username",
      "email",
      "created_at",
    ],
    filters: ["teacher", "from", "to"],
  },
  teachers: {
    label: "Teacher",
    pluralLabel: "Teachers",
    description:
      "Search teacher accounts by username or email, and filter by approval status.",
    searchPlaceholder: "Search teacher username or email",
    searchHint:
      "Searches teacher username, email, and approval status. This view is admin-only.",
    view: "search_teachers",
    idColumn: "teacher_id",
    scopeColumn: "teacher_id",
    dateColumn: "created_at",
    statusColumn: "status",
    statusLabel: "Account status",
    statusOptions: [
      { value: "pending", label: "Pending" },
      { value: "approved", label: "Approved" },
      { value: "rejected", label: "Rejected" },
      { value: "suspended", label: "Suspended" },
    ],
    searchColumns: ["username", "email", "status"],
    searchableFields: ["Teacher username", "Email", "Account status"],
    sortColumns: {
      name: "username",
      date: "created_at",
      status: "status",
    },
    sortFields: ["name", "date", "status"],
    select: [
      "teacher_id",
      "username",
      "email",
      "status",
      "quiz_count",
      "created_at",
    ],
    filters: ["status", "from", "to"],
  },
};

type RoleSearchConfig = {
  label: string;
  defaultEntity: SearchEntity;
  entities: readonly SearchEntity[];
};

export const ROLE_CONFIG: Record<SearchRole, RoleSearchConfig> = {
  teacher: {
    label: "Teacher",
    defaultEntity: "quizzes",
    entities: ["students", "student_accounts", "quizzes"],
  },
  admin: {
    label: "Admin",
    defaultEntity: "quizzes",
    entities: ["students", "student_accounts", "quizzes", "teachers"],
  },
};

export function getEntityConfig(entity: SearchEntity): SearchEntityConfig {
  return entityConfigs[entity];
}

export function getVisibleFilterKeys(
  role: SearchRole,
  entity: SearchEntity,
): SearchFilterKey[] {
  return getEntityConfig(entity).filters.filter((key) => {
    const definition = FILTER_DEFINITIONS[key];
    if (definition.roles && !definition.roles.includes(role)) {
      return false;
    }
    if (definition.entities && !definition.entities.includes(entity)) {
      return false;
    }
    return true;
  });
}

export function getStatusLabel(
  entity: SearchEntity,
  status: string,
): string {
  const option = getEntityConfig(entity).statusOptions.find(
    (candidate) => candidate.value === status,
  );

  if (option) {
    return option.label;
  }

  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
