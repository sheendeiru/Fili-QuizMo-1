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
  statusColumn: string;
  statusLabel: string;
  statusOptions: readonly SearchStatusOption[];
  accountStatusColumn: string | null;
  searchColumns: readonly string[];
  searchableFields: readonly string[];
  sortColumns: Record<SearchSortField, string>;
  select: readonly string[];
  filters: readonly SearchFilterKey[];
};

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MAX_SEARCH_LENGTH = 200;

export const ACCOUNT_STATUS_OPTIONS: readonly SearchStatusOption[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

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
  accountStatus: {
    label: "Account status",
    type: "select",
    roles: ["admin"],
    entities: ["students", "teachers"],
  },
  teacher: {
    label: "Teacher username",
    type: "text",
    entities: ["students", "quizzes", "participants"],
    maxLength: 100,
    placeholder: "e.g. msantos",
  },
  quiz: {
    label: "Quiz title",
    type: "text",
    entities: ["participants"],
    maxLength: 200,
    placeholder: "e.g. Science Fundamentals",
  },
  session: {
    label: "Session ID",
    type: "text",
    entities: ["participants"],
    maxLength: 100,
    placeholder: "e.g. SESS-1042",
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
  students: {
    label: "Student",
    pluralLabel: "Students",
    description:
      "Search students by name, school ID, email, enrollment status, or account status.",
    searchPlaceholder: "Search name, school ID, or email",
    searchHint:
      "Searches name, school ID, email, enrollment status, and account status. Passwords are never searchable.",
    view: "search_students",
    idColumn: "student_id",
    scopeColumn: "teacher_id",
    dateColumn: "created_at",
    statusColumn: "enrollment_status",
    statusLabel: "Enrollment status",
    statusOptions: [
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" },
      { value: "graduated", label: "Graduated" },
    ],
    accountStatusColumn: "account_status",
    searchColumns: [
      "name",
      "school_id",
      "email",
      "enrollment_status",
      "account_status",
    ],
    searchableFields: [
      "Name",
      "School ID",
      "Email",
      "Enrollment status",
      "Account status",
    ],
    sortColumns: {
      name: "name",
      date: "created_at",
      status: "enrollment_status",
    },
    select: [
      "student_id",
      "teacher_id",
      "teacher_username",
      "name",
      "school_id",
      "email",
      "enrollment_status",
      "account_status",
      "created_at",
    ],
    filters: ["status", "accountStatus", "teacher", "from", "to"],
  },
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
      { value: "published", label: "Published" },
      { value: "archived", label: "Archived" },
    ],
    accountStatusColumn: null,
    searchColumns: ["title", "status"],
    searchableFields: ["Quiz title", "Status"],
    sortColumns: {
      name: "title",
      date: "created_at",
      status: "status",
    },
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
  participants: {
    label: "Participant",
    pluralLabel: "Participants",
    description:
      "Search participant usernames, quiz titles, status, session ID, or school ID.",
    searchPlaceholder: "Search username, quiz, session, or school ID",
    searchHint:
      "Searches participant username, status, quiz title, school ID, and email. Session and quiz filters are also available.",
    view: "search_participants",
    idColumn: "participant_id",
    scopeColumn: "student_teacher_id",
    dateColumn: "joined_at",
    statusColumn: "status",
    statusLabel: "Participant status",
    statusOptions: [
      { value: "not_started", label: "Not started" },
      { value: "in_progress", label: "In progress" },
      { value: "completed", label: "Completed" },
    ],
    accountStatusColumn: null,
    searchColumns: [
      "username",
      "status",
      "quiz_title",
      "student_school_id",
      "student_email",
    ],
    searchableFields: [
      "Participant username",
      "Participant status",
      "Quiz title",
      "School ID",
      "Email",
    ],
    sortColumns: {
      name: "username",
      date: "joined_at",
      status: "status",
    },
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
      "student_school_id",
      "student_email",
      "teacher_id",
      "teacher_username",
    ],
    filters: ["status", "teacher", "quiz", "session", "from", "to"],
  },
  teachers: {
    label: "Teacher",
    pluralLabel: "Teachers",
    description:
      "Search teacher accounts by username or email, and filter by account status.",
    searchPlaceholder: "Search teacher username or email",
    searchHint:
      "Searches teacher username, email, and account status. This view is admin-only.",
    view: "search_teachers",
    idColumn: "teacher_id",
    scopeColumn: "teacher_id",
    dateColumn: "created_at",
    statusColumn: "account_status",
    statusLabel: "Account status",
    statusOptions: ACCOUNT_STATUS_OPTIONS,
    accountStatusColumn: "account_status",
    searchColumns: ["username", "email", "account_status"],
    searchableFields: ["Teacher username", "Email", "Account status"],
    sortColumns: {
      name: "username",
      date: "created_at",
      status: "account_status",
    },
    select: [
      "teacher_id",
      "username",
      "email",
      "account_status",
      "quiz_count",
      "created_at",
    ],
    filters: ["accountStatus", "from", "to"],
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
    entities: ["students", "quizzes", "participants"],
  },
  admin: {
    label: "Admin",
    defaultEntity: "quizzes",
    entities: ["students", "quizzes", "participants", "teachers"],
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
