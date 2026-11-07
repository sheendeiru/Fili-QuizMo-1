import { getEntityConfig } from "./config";
import { SearchError } from "./errors";
import { assertEntityAllowed } from "./scope";
import type {
  SearchPlan,
  SearchPlanFilter,
  SearchQuery,
  SearchScope,
} from "./types";

export function escapeLikePattern(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

export function containsPattern(value: string): string {
  return `%${escapeLikePattern(value)}%`;
}

export function quotePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Builds a PostgREST `or` expression from columns that come from the
 * server-side configuration. User input only ever reaches the quoted pattern.
 */
export function buildPostgrestOrFilter(
  columns: readonly string[],
  pattern: string,
): string {
  return columns
    .map((column) => `${column}.ilike.${quotePostgrestValue(pattern)}`)
    .join(",");
}

export function buildSearchPlan(
  query: SearchQuery,
  scope: SearchScope,
): SearchPlan {
  assertEntityAllowed(scope.role, query.entity);

  if (scope.role === "teacher" && !scope.teacherId) {
    throw new SearchError(
      403,
      "SCOPE_REQUIRED",
      "A teacher scope is required for this search.",
    );
  }

  const config = getEntityConfig(query.entity);
  const filters: SearchPlanFilter[] = [];

  // The permission scope is always the first filter. User-supplied filters
  // can only narrow this set; they can never replace or widen it.
  if (scope.role === "teacher" && scope.teacherId) {
    filters.push({
      column: config.scopeColumn,
      operator: "eq",
      value: scope.teacherId,
    });
  }

  if (
    query.status &&
    config.statusColumn &&
    config.filters.includes("status")
  ) {
    filters.push({
      column: config.statusColumn,
      operator: "eq",
      value: query.status,
    });
  }

  if (query.teacher && config.filters.includes("teacher")) {
    filters.push({
      column: "teacher_username",
      operator: "ilike",
      value: containsPattern(query.teacher),
    });
  }

  if (query.quiz && config.filters.includes("quiz")) {
    filters.push({
      column: "quiz_title",
      operator: "ilike",
      value: containsPattern(query.quiz),
    });
  }

  if (query.session && config.filters.includes("session")) {
    filters.push({
      column: "session_code",
      operator: "ilike",
      value: containsPattern(query.session),
    });
  }

  if (query.from) {
    filters.push({
      column: config.dateColumn,
      operator: "gte",
      value: `${query.from}T00:00:00.000Z`,
    });
  }

  if (query.to) {
    filters.push({
      column: config.dateColumn,
      operator: "lte",
      value: `${query.to}T23:59:59.999999Z`,
    });
  }

  const offset = (query.page - 1) * query.pageSize;

  return {
    entity: query.entity,
    view: config.view,
    select: [...config.select],
    filters,
    // Admin quiz list: only quizzes owned by an existing teacher account.
    // search_quizzes.teacher_id is '' (not null) when there is no teacher row,
    // so the repository requires a non-empty value. Same rule as
    // isRelevantQuiz in lib/dashboard/data.ts, so the table and cards agree.
    ...(scope.role === "admin" && query.entity === "quizzes"
      ? { requireColumns: ["teacher_id"] }
      : {}),
    search: query.q
      ? {
          columns: [...config.searchColumns],
          pattern: containsPattern(query.q),
          rawTerm: query.q,
        }
      : null,
    order: [
      {
        column: config.sortColumns[query.sort],
        ascending: query.dir === "asc",
      },
      {
        column: config.idColumn,
        ascending: true,
      },
    ],
    range: {
      from: offset,
      to: offset + query.pageSize - 1,
    },
    count: "exact",
  };
}

export function hasTeacherScope(
  plan: SearchPlan,
  scope: SearchScope,
): boolean {
  if (scope.role !== "teacher") {
    return true;
  }

  const firstFilter = plan.filters[0];
  const config = getEntityConfig(plan.entity);

  return Boolean(
    scope.teacherId &&
      firstFilter &&
      firstFilter.column === config.scopeColumn &&
      firstFilter.operator === "eq" &&
      firstFilter.value === scope.teacherId,
  );
}
