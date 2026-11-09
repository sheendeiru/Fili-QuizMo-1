import {
  buildPostgrestOrFilter,
  quotePostgrestValue,
} from "./query-builder";
import { SearchError } from "./errors";
import type {
  SearchPlan,
  SearchRepository,
  SearchRow,
} from "./types";

type SearchDbError = {
  code?: string;
  message: string;
};

type SearchQueryResult = {
  data: SearchRow[] | null;
  error: SearchDbError | null;
  count: number | null;
};

type SearchBuilder = {
  select(
    columns: string,
    options: { count: "exact" },
  ): SearchBuilder;
  eq(column: string, value: string): SearchBuilder;
  ilike(column: string, pattern: string): SearchBuilder;
  neq(column: string, value: string): SearchBuilder;
  gte(column: string, value: string): SearchBuilder;
  lte(column: string, value: string): SearchBuilder;
  or(expression: string): SearchBuilder;
  order(
    column: string,
    options: { ascending: boolean },
  ): SearchBuilder;
  range(
    from: number,
    to: number,
  ): SearchBuilder & PromiseLike<SearchQueryResult>;
};

export type SupabaseSearchClient = {
  from(view: string): unknown;
};

export function mapSearchDbError(error: SearchDbError): SearchError {
  if (error.code === "PGRST205" || error.code === "42P01") {
    return new SearchError(
      503,
      "SEARCH_NOT_CONFIGURED",
      "The search views are not installed yet. Apply the search migration in supabase/migrations, then try again.",
      { code: error.code },
    );
  }

  if (error.code === "42501") {
    return new SearchError(
      403,
      "SEARCH_FORBIDDEN",
      "The database denied access to these search results.",
      { code: error.code },
    );
  }

  return new SearchError(
    500,
    "SEARCH_QUERY_FAILED",
    "Unable to load search results.",
    { code: error.code ?? "UNKNOWN" },
  );
}

export class SupabaseSearchRepository implements SearchRepository {
  readonly dataSource = "supabase" as const;

  constructor(private readonly client: SupabaseSearchClient) {}

  async search(
    plan: SearchPlan,
  ): Promise<{ rows: SearchRow[]; total: number }> {
    let query = (
      this.client.from(plan.view) as SearchBuilder
    ).select(plan.select.join(","), { count: "exact" });

    for (const filter of plan.filters) {
      if (filter.operator === "eq") {
        query = query.eq(filter.column, filter.value);
      } else if (filter.operator === "ilike") {
        query = query.ilike(filter.column, filter.value);
      } else if (filter.operator === "ilike_any") {
        const values = filter.values ?? [];

        // Nothing can match an empty list (a class with no students).
        if (values.length === 0) {
          return { rows: [], total: 0 };
        }

        query = query.or(
          values
            .map(
              (value) =>
                `${filter.column}.ilike.${quotePostgrestValue(value)}`,
            )
            .join(","),
        );
      } else if (filter.operator === "gte") {
        query = query.gte(filter.column, filter.value);
      } else {
        query = query.lte(filter.column, filter.value);
      }
    }

    for (const column of plan.requireColumns ?? []) {
      // neq also drops NULLs, so both null and '' values are left out.
      query = query.neq(column, "");
    }

    if (plan.search) {
      if (plan.search.columns.length === 1) {
        query = query.ilike(
          plan.search.columns[0],
          plan.search.pattern,
        );
      } else {
        query = query.or(
          buildPostgrestOrFilter(
            plan.search.columns,
            plan.search.pattern,
          ),
        );
      }
    }

    for (const order of plan.order) {
      query = query.order(order.column, {
        ascending: order.ascending,
      });
    }

    const { data, error, count } = await query.range(
      plan.range.from,
      plan.range.to,
    );

    if (error) {
      throw mapSearchDbError(error);
    }

    const rows = data ?? [];

    return {
      rows,
      total: count ?? rows.length,
    };
  }
}
