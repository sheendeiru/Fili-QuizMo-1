"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  FILTER_DEFINITIONS,
  SORT_OPTIONS,
  getEntityConfig,
  getStatusLabel,
  getVisibleFilterKeys,
} from "@/lib/search/config";
import { getActiveFilterChips } from "@/lib/search/active-filters";
import { defaultSearchQuery } from "@/lib/search/url-state";
import { useSearchFilters } from "@/lib/search/use-search-filters";
import type {
  SearchEntity,
  SearchFilterKey,
  SearchItem,
  SearchQuery,
  SearchRole,
} from "@/lib/search/types";
import { PixelLoader } from "@/components/ui/pixel-loader";
import { SESSION_ENDED_EVENT } from "@/lib/auth/session-state";

type SearchFilterProps = {
  role: SearchRole;
  entity: SearchEntity;
};

function DebouncedTextInput({
  id,
  value,
  placeholder,
  maxLength,
  type = "text",
  describedBy,
  onValueChange,
}: {
  id: string;
  value: string;
  placeholder?: string;
  maxLength?: number;
  type?: "search" | "text";
  describedBy?: string;
  onValueChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const callbackRef = useRef(onValueChange);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    callbackRef.current = onValueChange;
  }, [onValueChange]);

  useEffect(() => {
    function clearDraft() {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setDraft("");
    }

    window.addEventListener(SESSION_ENDED_EVENT, clearDraft);
    return () => {
      window.removeEventListener(SESSION_ENDED_EVENT, clearDraft);
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <input
      id={id}
      type={type}
      value={draft}
      maxLength={maxLength}
      placeholder={placeholder}
      aria-describedby={describedBy}
      onChange={(event) => {
        const nextValue = event.currentTarget.value;
        setDraft(nextValue);
        if (timeoutRef.current !== null) {
          window.clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = window.setTimeout(
          () => callbackRef.current(nextValue),
          300,
        );
      }}
      className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
    />
  );
}

function itemValues(item: SearchItem): string[] {
  if (item.entity === "students") {
    return [
      item.username,
      item.email,
      item.teacherUsername,
      new Date(item.createdAt).toLocaleDateString("en-PH", {
        dateStyle: "medium",
      }),
    ];
  }

  if (item.entity === "quizzes") {
    return [
      item.title,
      getStatusLabel("quizzes", item.status),
      String(item.questionCount),
      item.teacherUsername,
      new Date(item.createdAt).toLocaleDateString("en-PH", {
        dateStyle: "medium",
      }),
    ];
  }

  if (item.entity === "participants") {
    return [
      item.username,
      item.quizTitle,
      item.sessionCode,
      item.studentEmail,
      getStatusLabel("participants", item.status),
      item.score === null ? "—" : String(item.score),
      new Date(item.joinedAt).toLocaleDateString("en-PH", {
        dateStyle: "medium",
      }),
    ];
  }

  return [
    item.username,
    item.email,
    getStatusLabel("teachers", item.status),
    String(item.quizCount),
    new Date(item.createdAt).toLocaleDateString("en-PH", {
      dateStyle: "medium",
    }),
  ];
}

function FilterFields({
  role,
  entity,
  query,
  updateQuery,
  idPrefix,
}: {
  role: SearchRole;
  entity: SearchEntity;
  query: SearchQuery;
  updateQuery: (patch: Partial<SearchQuery>) => void;
  idPrefix: string;
}) {
  const config = getEntityConfig(entity);

  function renderFilter(key: SearchFilterKey) {
    const definition = FILTER_DEFINITIONS[key];
    const id = `${idPrefix}-${key}`;

    if (key === "status") {
      return (
        <label key={key} htmlFor={id} className="block text-sm font-medium">
          {config.statusLabel}
          <select
            id={id}
            value={query.status ?? ""}
            onChange={(event) =>
              updateQuery({ status: event.currentTarget.value || null })
            }
            className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
          >
            <option value="">All statuses</option>
            {config.statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (key === "from" || key === "to") {
      return (
        <label key={key} htmlFor={id} className="block text-sm font-medium">
          {definition.label}
          <input
            id={id}
            type="date"
            value={query[key] ?? ""}
            onChange={(event) => {
              const value = event.currentTarget.value || null;
              if (key === "from") {
                updateQuery({ from: value });
              } else {
                updateQuery({ to: value });
              }
            }}
            className="mt-1 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2"
          />
        </label>
      );
    }

    const value =
      key === "teacher"
        ? query.teacher
        : key === "quiz"
          ? query.quiz
          : query.session;

    return (
      <label key={key} htmlFor={id} className="block text-sm font-medium">
        {definition.label}
        <DebouncedTextInput
          key={`${key}-${value}`}
          id={id}
          value={value}
          maxLength={definition.maxLength}
          placeholder={definition.placeholder}
          onValueChange={(nextValue) => {
            if (key === "teacher") {
              updateQuery({ teacher: nextValue });
            } else if (key === "quiz") {
              updateQuery({ quiz: nextValue });
            } else {
              updateQuery({ session: nextValue });
            }
          }}
        />
      </label>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {getVisibleFilterKeys(role, entity).map(renderFilter)}
    </div>
  );
}

export function SearchFilter({ role, entity }: SearchFilterProps) {
  const {
    query,
    results,
    loading,
    error,
    updateQuery,
  } = useSearchFilters(role, entity);
  const config = getEntityConfig(entity);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const mobileFilterButtonRef = useRef<HTMLButtonElement>(null);

  function clearAllFilters() {
    updateQuery(defaultSearchQuery(role, entity));
    if (mobileFiltersOpen) {
      closeMobileFilters();
    }
  }

  function closeMobileFilters() {
    setMobileFiltersOpen(false);
    window.requestAnimationFrame(() => mobileFilterButtonRef.current?.focus());
  }

  function handleMobileDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      closeMobileFilters();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const dialog = event.currentTarget;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (
      event.shiftKey &&
      first &&
      document.activeElement === first
    ) {
      event.preventDefault();
      last?.focus();
    } else if (
      !event.shiftKey &&
      last &&
      document.activeElement === last
    ) {
      event.preventDefault();
      first?.focus();
    }
  }

  function removeFilter(key: SearchFilterKey | "q") {
    if (key === "q") {
      updateQuery({ q: "" });
      return;
    }
    if (key === "status") {
      updateQuery({ status: null });
      return;
    }
    if (key === "teacher" || key === "quiz" || key === "session") {
      if (key === "teacher") {
        updateQuery({ teacher: "" });
      } else if (key === "quiz") {
        updateQuery({ quiz: "" });
      } else {
        updateQuery({ session: "" });
      }
      return;
    }
    updateQuery({ [key]: null });
  }

  const chips = getActiveFilterChips(query);
  const items = results?.items ?? [];
  const pagination = results?.pagination;

  return (
    <section aria-label={`${config.pluralLabel} search`} className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm sm:p-5">
        <label
          htmlFor={`${entity}-search`}
          className="block text-sm font-semibold text-foreground"
        >
          Search {config.pluralLabel.toLowerCase()}
        </label>
        <DebouncedTextInput
          key={`q-${query.q}`}
          id={`${entity}-search`}
          type="search"
          value={query.q}
          maxLength={200}
          placeholder={config.searchPlaceholder}
          describedBy={`${entity}-search-hint`}
          onValueChange={(value) => updateQuery({ q: value })}
        />
        <p id={`${entity}-search-hint`} className="mt-1 text-xs text-neutral-500">
          {config.searchHint}
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            ref={mobileFilterButtonRef}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium md:hidden"
            aria-expanded={mobileFiltersOpen}
            aria-controls={`${entity}-mobile-filters`}
            onClick={() => setMobileFiltersOpen(true)}
          >
            Show filters
          </button>
          <div className="flex items-center gap-2">
            <label htmlFor={`${entity}-sort`} className="text-sm font-medium">
              Sort by
            </label>
            <select
              id={`${entity}-sort`}
              value={query.sort}
              onChange={(event) =>
                updateQuery({
                  sort: event.currentTarget.value as SearchQuery["sort"],
                })
              }
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <label htmlFor={`${entity}-direction`} className="sr-only">
              Sort direction
            </label>
            <select
              id={`${entity}-direction`}
              value={query.dir}
              onChange={(event) =>
                updateQuery({
                  dir: event.currentTarget.value as SearchQuery["dir"],
                })
              }
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
          <button
            type="button"
            onClick={clearAllFilters}
            disabled={chips.length === 0}
            className="border-2 border-amber-300 bg-transparent px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-300 hover:text-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:border-neutral-500 disabled:text-neutral-500"
          >
            Clear all filters
          </button>
        </div>

        <div className="mt-4 hidden md:block">
          <FilterFields
            role={role}
            entity={entity}
            query={query}
            updateQuery={updateQuery}
            idPrefix={`${entity}-desktop`}
          />
        </div>
      </div>

      {mobileFiltersOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 p-4 md:hidden"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeMobileFilters();
            }
          }}
        >
          <section
            id={`${entity}-mobile-filters`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${entity}-mobile-filters-title`}
            onKeyDown={handleMobileDialogKeyDown}
            className="ml-auto h-full w-full max-w-sm overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h3
                id={`${entity}-mobile-filters-title`}
                className="text-lg font-semibold"
              >
                Filters
              </h3>
              <button
                type="button"
                autoFocus
                onClick={closeMobileFilters}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              >
                Close filters
              </button>
            </div>
            <FilterFields
              role={role}
              entity={entity}
              query={query}
              updateQuery={updateQuery}
              idPrefix={`${entity}-mobile`}
            />
          </section>
        </div>
      ) : null}

      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-2" aria-label="Active filters">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-2 rounded-full bg-selected-option/30 px-3 py-1 text-sm text-foreground"
            >
              {chip.label}: {chip.value}
              <button
                type="button"
                aria-label={`Remove ${chip.label} filter`}
                onClick={() => removeFilter(chip.key)}
                className="font-bold"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {loading
          ? "Loading search results"
          : pagination
            ? `${pagination.total} ${config.pluralLabel.toLowerCase()} found`
            : ""}
      </p>

      {loading ? (
        <PixelLoader label="Loading search results..." />
      ) : null}
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-3 border-2 border-red-400 bg-red-950/60 p-4 text-sm text-red-200"
        >
          {error}
        </div>
      ) : null}

      {!loading && !error && results && items.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-sm text-neutral-600">
          No results match your filters.
        </p>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-max min-w-full divide-y divide-neutral-200 text-left text-sm">
            <caption className="sr-only">{config.pluralLabel} search results</caption>
            <thead className="bg-neutral-50">
              <tr>
                {resultHeaders(entity).map((header) => (
                  <th
                    key={header}
                    scope="col"
                    className="sticky top-0 min-w-24 whitespace-nowrap bg-neutral-50 px-4 py-3 font-semibold text-foreground sm:px-6"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map((item) => (
                <tr key={item.id}>
                  {itemValues(item).map((value, index) => (
                    <td
                      key={`${item.id}-${index}`}
                      className="whitespace-nowrap px-4 py-3 text-neutral-700 sm:px-6"
                    >
                      {value || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {pagination && pagination.totalPages > 1 ? (
        <nav
          aria-label="Search result pages"
          className="flex items-center justify-between gap-4 rounded-xl bg-white p-4"
        >
          <p className="text-sm text-neutral-600">
            Page {pagination.page} of {pagination.totalPages} ·{" "}
            {pagination.total} results
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => updateQuery({ page: pagination.page - 1 })}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => updateQuery({ page: pagination.page + 1 })}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </nav>
      ) : null}
    </section>
  );
}

function resultHeaders(entity: SearchEntity): string[] {
  if (entity === "students") {
    return ["Student", "School ID", "Email", "Enrollment status", "Account status"];
  }
  if (entity === "quizzes") {
    return ["Quiz", "Status", "Questions", "Teacher", "Created"];
  }
  if (entity === "participants") {
    return ["Username", "Quiz", "Session", "School ID", "Status", "Score", "Joined"];
  }
  return ["Teacher", "Email", "Account status", "Quizzes", "Created"];
}
