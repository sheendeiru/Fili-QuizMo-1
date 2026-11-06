import type {
  SearchApiErrorBody,
  SearchQuery,
  SearchResponse,
} from "./types";
import { expireSessionAndRedirect } from "@/lib/auth/session-state";

export class SearchApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "SearchApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function buildSearchApiParams(
  query: SearchQuery,
): URLSearchParams {
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
  if (query.from) {
    params.set("from", query.from);
  }
  if (query.to) {
    params.set("to", query.to);
  }

  params.set("sort", query.sort);
  params.set("dir", query.dir);
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));

  return params;
}

function isErrorBody(value: unknown): value is SearchApiErrorBody {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const error = (value as { error?: unknown }).error;

  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { code?: unknown }).code === "string" &&
    typeof (error as { message?: unknown }).message === "string"
  );
}

function isSearchResponse(value: unknown): value is SearchResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<SearchResponse>;

  return (
    Array.isArray(candidate.items) &&
    typeof candidate.pagination === "object" &&
    candidate.pagination !== null &&
    typeof candidate.meta === "object" &&
    candidate.meta !== null
  );
}

export async function fetchSearchResults(
  query: SearchQuery,
  signal?: AbortSignal,
  options: { sessionExpiredPath?: string } = {},
): Promise<SearchResponse> {
  const params = buildSearchApiParams(query);
  const response = await fetch(`/api/search?${params.toString()}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal,
  });

  // A signed-out request can be redirected to an HTML login page. Treat it
  // like a 401 instead of failing later with an "unexpected response" error.
  if (response.redirected && typeof window !== "undefined") {
    await expireSessionAndRedirect(options.sessionExpiredPath);
    throw new SearchApiError(
      401,
      "UNAUTHENTICATED",
      "Your session has ended. Please sign in again.",
    );
  }

  let body: unknown = null;

  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      await expireSessionAndRedirect(options.sessionExpiredPath);
    }

    if (isErrorBody(body)) {
      throw new SearchApiError(
        response.status,
        body.error.code,
        body.error.message,
        body.error.details,
      );
    }

    throw new SearchApiError(
      response.status,
      "SEARCH_REQUEST_FAILED",
      "Unable to load search results.",
    );
  }

  if (!isSearchResponse(body)) {
    throw new SearchApiError(
      500,
      "INVALID_SEARCH_RESPONSE",
      "The search service returned an unexpected response.",
    );
  }

  return body;
}
