import { DEFAULT_PAGE_SIZE, ROLE_CONFIG } from "./config";
import { parseSearchQuery } from "./validation";
import type { SearchQuery, SearchRole } from "./types";

export function defaultSearchQuery(
  role: SearchRole = "teacher",
  entity: SearchQuery["entity"] = ROLE_CONFIG[role].defaultEntity,
): SearchQuery {
  return {
    entity,
    q: "",
    status: null,
    teacher: "",
    quiz: "",
    session: "",
    class: "",
    from: null,
    to: null,
    sort: "date",
    dir: "desc",
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  };
}

export function serializeSearchState(query: SearchQuery): string {
  const params = new URLSearchParams();

  params.set("entity", query.entity);
  if (query.q) {
    params.set("q", query.q);
  }
  if (query.status) {
    params.set("status", query.status);
  }
  if (query.teacher) {
    params.set("teacher", query.teacher);
  }
  if (query.quiz) {
    params.set("quiz", query.quiz);
  }
  if (query.session) {
    params.set("session", query.session);
  }
  if (query.class) {
    params.set("class", query.class);
  }
  if (query.from) {
    params.set("from", query.from);
  }
  if (query.to) {
    params.set("to", query.to);
  }
  if (query.sort !== "date") {
    params.set("sort", query.sort);
  }
  if (query.dir !== "desc") {
    params.set("dir", query.dir);
  }
  if (query.page !== 1) {
    params.set("page", String(query.page));
  }
  if (query.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set("pageSize", String(query.pageSize));
  }

  return params.toString();
}

export function parseSearchState(
  search: string,
  role: SearchRole,
): SearchQuery {
  return parseSearchQuery(new URLSearchParams(search), role);
}
