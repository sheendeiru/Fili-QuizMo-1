import { createDemoRows } from "./demo-data";
import { MockSearchRepository } from "./mock-repository";
import {
  SupabaseSearchRepository,
  type SupabaseSearchClient,
} from "./supabase-repository";
import type {
  SearchDataSource,
  SearchRepository,
  SearchScope,
} from "./types";

/**
 * Real Supabase data is the default everywhere, including `npm run dev`.
 * Demo rows are only used when SEARCH_DATA_SOURCE=mock is set explicitly,
 * and never in production, so a stray env var cannot show fake students.
 */
export function getSearchDataSource(): SearchDataSource {
  const configured = process.env.SEARCH_DATA_SOURCE?.trim().toLowerCase();

  if (configured === "mock" && process.env.NODE_ENV !== "production") {
    return "mock";
  }

  return "supabase";
}

export function createSearchRepository(input: {
  dataSource: SearchDataSource;
  supabase: SupabaseSearchClient;
  scope: SearchScope;
}): SearchRepository {
  if (input.dataSource === "mock") {
    return new MockSearchRepository(
      createDemoRows({
        role: input.scope.role,
        teacherId: input.scope.teacherId,
        teacherUsername: input.scope.teacherLabel,
      }),
    );
  }

  return new SupabaseSearchRepository(input.supabase);
}
