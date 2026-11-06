"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchSearchResults } from "./api-client";
import { DASHBOARD_DATA_CHANGED_EVENT } from "@/lib/dashboard/realtime-events";
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

function sessionExpiredPathFor(role: SearchRole): string {
  return role === "teacher"
    ? "/teacher-login?status=session_expired"
    : "/admin-login?status=session_expired";
}

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
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    function handleDataChanged() {
      setRefreshKey((key) => key + 1);
    }

    window.addEventListener(DASHBOARD_DATA_CHANGED_EVENT, handleDataChanged);
    return () =>
      window.removeEventListener(DASHBOARD_DATA_CHANGED_EVENT, handleDataChanged);
  }, []);

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

      // Searching, filtering, sorting and paging only change what the table
      // asks /api/search for, so the page does not need to render again on the
      // server. Updating the URL with the History API keeps the address bar and
      // useSearchParams in sync (Next.js supports this) without a route
      // transition: no app-wide loading screen and no server round trip.
      if (addHistoryEntry) {
        window.history.pushState(null, "", nextUrl);
      } else {
        window.history.replaceState(null, "", nextUrl);
      }
    },
    [pathname, query],
  );

  useEffect(() => {
    if (parsedState.error) {
      return;
    }

    const controller = createSessionRequestController();
    let active = true;

    queueMicrotask(() => {
      if (active) {
        // A live refresh re-runs the same query. Keep the rows on screen
        // while it loads so the table does not flash empty on every change.
        setRequest((previous) =>
          previous.key === queryKey
            ? previous
            : {
                key: queryKey,
                results: null,
                loading: true,
                error: "",
              },
        );
      }
    });

    fetchSearchResults(query, controller.signal, {
      sessionExpiredPath: sessionExpiredPathFor(role),
    })
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
  }, [parsedState.error, query, queryKey, refreshKey, role]);

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
