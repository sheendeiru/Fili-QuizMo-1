"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigation } from "@/components/pixel";
import { fetchSearchResults } from "./api-client";
import {
  defaultSearchQuery,
  parseSearchState,
  serializeSearchState,
} from "./url-state";
import {
  createSessionRequestController,
  releaseSessionRequestController,
} from "@/lib/auth/session-state";
import type { SearchQuery, SearchResponse, SearchRole } from "./types";

function messageFromError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unable to load search results.";
}

type SearchRequestState = {
  key: string;
  results: SearchResponse | null;
  loading: boolean;
  error: string;
};

export function useSearchFilters(
  role: SearchRole,
  initialEntity: SearchQuery["entity"],
) {
  const router = useRouter();
  const { navigate } = useNavigation();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const parsedState = useMemo(() => {
    try {
      const current = new URLSearchParams(search);
      const parsed = parseSearchState(search, role);

      return {
        query: current.has("entity")
          ? parsed
          : { ...parsed, entity: initialEntity },
        error: "",
      };
    } catch (error) {
      return {
        query: defaultSearchQuery(role, initialEntity),
        error: messageFromError(error),
      };
    }
  }, [initialEntity, role, search]);
  const query = parsedState.query;
  const queryKey = serializeSearchState(query);
  const [request, setRequest] = useState<SearchRequestState>({
    key: "",
    results: null,
    loading: false,
    error: "",
  });

  const updateQuery = useCallback(
    (patch: Partial<SearchQuery>, addHistoryEntry = false) => {
      const nextQuery = {
        ...query,
        ...patch,
        page: patch.page ?? 1,
      };
      const serialized = serializeSearchState(nextQuery);
      const nextUrl = serialized
        ? `${pathname}?${serialized}`
        : pathname;

      navigate(() =>
        addHistoryEntry
          ? router.push(nextUrl, { scroll: false })
          : router.replace(nextUrl, { scroll: false }),
      );
    },
    [navigate, pathname, query, router],
  );

  useEffect(() => {
    if (parsedState.error) {
      return;
    }

    const controller = createSessionRequestController();
    let active = true;

    queueMicrotask(() => {
      if (active) {
        setRequest({
          key: queryKey,
          results: null,
          loading: true,
          error: "",
        });
      }
    });

    fetchSearchResults(query, controller.signal)
      .then((results) => {
        if (active) {
          setRequest({
            key: queryKey,
            results,
            loading: false,
            error: "",
          });
        }
      })
      .catch((error: unknown) => {
        if (
          !active ||
          (error instanceof Error && error.name === "AbortError")
        ) {
          return;
        }

        setRequest({
          key: queryKey,
          results: null,
          loading: false,
          error: messageFromError(error),
        });
      })
      .finally(() => releaseSessionRequestController(controller));

    return () => {
      active = false;
      controller.abort();
      releaseSessionRequestController(controller);
    };
  }, [parsedState.error, query, queryKey]);

  const requestMatchesQuery = request.key === queryKey;

  return {
    query,
    results: requestMatchesQuery ? request.results : null,
    loading:
      !parsedState.error &&
      (!requestMatchesQuery || request.loading),
    error:
      parsedState.error ||
      (requestMatchesQuery ? request.error : ""),
    updateQuery,
  };
}
