import {
  DEFAULT_PAGE_SIZE,
  FILTER_DEFINITIONS,
  MAX_PAGE_SIZE,
  MAX_SEARCH_LENGTH,
  ROLE_CONFIG,
  getEntityConfig,
} from "./config";
import { SearchError } from "./errors";
import { assertEntityAllowed, assertFilterAllowed } from "./scope";
import {
  SEARCH_ENTITIES,
  SORT_FIELDS,
  type SearchEntity,
  type SearchQuery,
  type SearchRole,
  type SearchSortField,
} from "./types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const INTEGER_PATTERN = /^\d+$/;
const MAX_PAGE = 10_000;

function cleanText(
  value: string,
  field: string,
  label: string,
  maxLength: number,
): string {
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();

  if (cleaned.length > maxLength) {
    throw new SearchError(
      400,
      "INVALID_FILTER",
      `${label} must be ${maxLength} characters or fewer.`,
      { field, maxLength },
    );
  }

  return cleaned;
}

function parseDateParam(
  value: string | null,
  field: "from" | "to",
): string | null {
  if (value === null || value.trim() === "") {
    return null;
  }

  const normalized = value.trim();

  if (!DATE_PATTERN.test(normalized)) {
    throw new SearchError(
      400,
      "INVALID_FILTER",
      `The ${field} date must use YYYY-MM-DD format.`,
      { field },
    );
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== normalized
  ) {
    throw new SearchError(
      400,
      "INVALID_FILTER",
      `The ${field} date is not a valid calendar date.`,
      { field },
    );
  }

  return normalized;
}

function parseIntegerParam(input: {
  params: URLSearchParams;
  field: "page" | "pageSize";
  fallback: number;
  min: number;
  max: number;
  clampMaximum?: boolean;
}): number {
  const raw = input.params.get(input.field);

  if (raw === null || raw.trim() === "") {
    return input.fallback;
  }

  if (!INTEGER_PATTERN.test(raw.trim())) {
    throw new SearchError(
      400,
      "INVALID_FILTER",
      `The ${input.field} value must be a positive integer.`,
      { field: input.field },
    );
  }

  const value = Number(raw);

  if (!Number.isSafeInteger(value) || value < input.min) {
    throw new SearchError(
      400,
      "INVALID_FILTER",
      `The ${input.field} value must be at least ${input.min}.`,
      { field: input.field, min: input.min },
    );
  }

  if (value > input.max) {
    if (input.clampMaximum) {
      return input.max;
    }

    throw new SearchError(
      400,
      "INVALID_FILTER",
      `The ${input.field} value must be ${input.max} or less.`,
      { field: input.field, max: input.max },
    );
  }

  return value;
}

export function parseSearchQuery(
  params: URLSearchParams,
  role: SearchRole,
): SearchQuery {
  const rawEntity =
    params.get("entity")?.trim().toLowerCase() ??
    ROLE_CONFIG[role].defaultEntity;

  if (!SEARCH_ENTITIES.includes(rawEntity as SearchEntity)) {
    throw new SearchError(
      400,
      "INVALID_ENTITY",
      "Choose a valid search view.",
      { entity: rawEntity },
    );
  }

  const entity = rawEntity as SearchEntity;
  assertEntityAllowed(role, entity);

  if (params.has("password")) {
    throw new SearchError(
      400,
      "PASSWORD_NOT_SEARCHABLE",
      "Passwords cannot be searched or returned by this API.",
      { field: "password" },
    );
  }

  const config = getEntityConfig(entity);

  const q = cleanText(
    params.get("q") ?? "",
    "q",
    "Search text",
    MAX_SEARCH_LENGTH,
  );

  let status: string | null = null;
  if (params.has("status")) {
    assertFilterAllowed(role, entity, "status");
    const rawStatus = params.get("status")?.trim().toLowerCase() ?? "";

    if (rawStatus) {
      if (
        !config.statusOptions.some((option) => option.value === rawStatus)
      ) {
        throw new SearchError(
          400,
          "INVALID_FILTER",
          `The status "${rawStatus}" is not valid for ${config.pluralLabel.toLowerCase()}.`,
          { field: "status", entity },
        );
      }

      status = rawStatus;
    }
  }

  let teacher = "";
  if (params.has("teacher")) {
    assertFilterAllowed(role, entity, "teacher");
    teacher = cleanText(
      params.get("teacher") ?? "",
      "teacher",
      "Teacher username",
      FILTER_DEFINITIONS.teacher.maxLength ?? 100,
    );
  }

  let quiz = "";
  if (params.has("quiz")) {
    assertFilterAllowed(role, entity, "quiz");
    quiz = cleanText(
      params.get("quiz") ?? "",
      "quiz",
      "Quiz title",
      FILTER_DEFINITIONS.quiz.maxLength ?? 200,
    );
  }

  let session = "";
  if (params.has("session")) {
    assertFilterAllowed(role, entity, "session");
    session = cleanText(
      params.get("session") ?? "",
      "session",
      "Session ID",
      FILTER_DEFINITIONS.session.maxLength ?? 100,
    );
  }

  let from: string | null = null;
  if (params.has("from")) {
    assertFilterAllowed(role, entity, "from");
    from = parseDateParam(params.get("from"), "from");
  }

  let to: string | null = null;
  if (params.has("to")) {
    assertFilterAllowed(role, entity, "to");
    to = parseDateParam(params.get("to"), "to");
  }

  if (from && to && from > to) {
    throw new SearchError(
      400,
      "INVALID_FILTER",
      "The from date must be on or before the to date.",
      { field: "from" },
    );
  }

  const rawSort = params.get("sort")?.trim().toLowerCase() || "date";
  if (!SORT_FIELDS.includes(rawSort as SearchSortField)) {
    throw new SearchError(
      400,
      "INVALID_SORT",
      "Sort by name, date, or status.",
      { sort: rawSort },
    );
  }

  const sort = rawSort as SearchSortField;

  if (!config.sortFields.includes(sort)) {
    throw new SearchError(
      400,
      "INVALID_SORT",
      `The ${sort} sort is not available for ${config.pluralLabel.toLowerCase()}.`,
      { sort, entity },
    );
  }

  const rawDir = params.get("dir")?.trim().toLowerCase() || "desc";

  if (rawDir !== "asc" && rawDir !== "desc") {
    throw new SearchError(
      400,
      "INVALID_SORT",
      "Sort direction must be asc or desc.",
      { dir: rawDir },
    );
  }

  const page = parseIntegerParam({
    params,
    field: "page",
    fallback: 1,
    min: 1,
    max: MAX_PAGE,
  });

  const pageSize = parseIntegerParam({
    params,
    field: "pageSize",
    fallback: DEFAULT_PAGE_SIZE,
    min: 1,
    max: MAX_PAGE_SIZE,
    clampMaximum: true,
  });

  return {
    entity,
    q,
    status,
    teacher,
    quiz,
    session,
    from,
    to,
    sort,
    dir: rawDir,
    page,
    pageSize,
  };
}
