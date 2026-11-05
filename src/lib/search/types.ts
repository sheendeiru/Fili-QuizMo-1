export const SEARCH_ENTITIES = [
  "students",
  "student_accounts",
  "quizzes",
  "teachers",
] as const;

export type SearchEntity = (typeof SEARCH_ENTITIES)[number];

export const SEARCH_ROLES = ["teacher", "admin"] as const;

export type SearchRole = (typeof SEARCH_ROLES)[number];

export const SORT_FIELDS = ["name", "date", "status"] as const;

export type SearchSortField = (typeof SORT_FIELDS)[number];

export type SearchSortDirection = "asc" | "desc";

export type SearchDataSource = "supabase" | "mock";

export type SearchFilterKey =
  | "status"
  | "teacher"
  | "quiz"
  | "session"
  | "from"
  | "to";

export type SearchQuery = {
  entity: SearchEntity;
  q: string;
  status: string | null;
  teacher: string;
  quiz: string;
  session: string;
  from: string | null;
  to: string | null;
  sort: SearchSortField;
  dir: SearchSortDirection;
  page: number;
  pageSize: number;
};

export type SearchScope = {
  role: SearchRole;
  userId: string;
  teacherId: string | null;
  teacherLabel: string | null;
};

export type SearchPlanFilterOperator = "eq" | "ilike" | "gte" | "lte";

export type SearchPlanFilter = {
  column: string;
  operator: SearchPlanFilterOperator;
  value: string;
};

export type SearchPlan = {
  entity: SearchEntity;
  view: string;
  select: string[];
  filters: SearchPlanFilter[];
  search: {
    columns: string[];
    pattern: string;
    rawTerm: string;
  } | null;
  order: Array<{
    column: string;
    ascending: boolean;
  }>;
  range: {
    from: number;
    to: number;
  };
  count: "exact";
};

export type SearchRow = Record<string, unknown>;

export type SearchRepository = {
  readonly dataSource: SearchDataSource;
  search(
    plan: SearchPlan,
  ): Promise<{ rows: SearchRow[]; total: number }>;
};

export type QuizSearchItem = {
  entity: "quizzes";
  id: string;
  title: string;
  status: string;
  questionCount: number;
  teacherId: string;
  teacherUsername: string;
  createdAt: string;
};

export type StudentSearchItem = {
  entity: "students";
  id: string;
  username: string;
  status: string;
  score: number | null;
  quizId: string;
  quizTitle: string;
  sessionId: string;
  sessionCode: string;
  studentEmail: string;
  teacherId: string;
  teacherUsername: string;
  joinedAt: string;
};

export type StudentAccountSearchItem = {
  entity: "student_accounts";
  id: string;
  username: string;
  email: string;
  teacherId: string;
  teacherUsername: string;
  createdAt: string;
};

export type TeacherSearchItem = {
  entity: "teachers";
  id: string;
  username: string;
  email: string;
  status: string;
  quizCount: number;
  createdAt: string;
};

export type SearchItem =
  | StudentSearchItem
  | StudentAccountSearchItem
  | QuizSearchItem
  | TeacherSearchItem;

export type SearchAppliedFilters = {
  q: string;
  status: string | null;
  teacher: string;
  quiz: string;
  session: string;
  from: string | null;
  to: string | null;
};

export type SearchPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type SearchResponse = {
  items: SearchItem[];
  pagination: SearchPagination;
  meta: {
    entity: SearchEntity;
    role: SearchRole;
    scope: "own-records" | "all-records";
    dataSource: SearchDataSource;
    filters: SearchAppliedFilters;
    sort: SearchSortField;
    dir: SearchSortDirection;
    searchableFields: string[];
  };
};

export type SearchApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};
