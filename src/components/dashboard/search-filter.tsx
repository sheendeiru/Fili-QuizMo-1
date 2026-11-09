"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
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
import {
  PixelBadge,
  PixelButton,
  PixelCard,
  PixelInput,
} from "@/components/ui/pixel-primitives";
import {
  PaginatedTable,
  type PaginatedTableColumn,
} from "@/components/ui/paginated-table";
import { SESSION_ENDED_EVENT } from "@/lib/auth/session-state";

type SearchFilterProps = {
  role: SearchRole;
  entity: SearchEntity;
  toolbar?: ReactNode;
  renderActions?: (item: SearchItem) => ReactNode;
};

function DebouncedTextInput({
  id,
  value,
  placeholder,
  maxLength,
  type = "text",
  describedBy,
  className = "mt-0.5 h-9 w-full px-3 text-sm",
  onValueChange,
}: {
  id: string;
  value: string;
  placeholder?: string;
  maxLength?: number;
  type?: "search" | "text";
  describedBy?: string;
  className?: string;
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
    <PixelInput
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
      className={className}
    />
  );
}

function itemValues(item: SearchItem): string[] {
  if (item.entity === "students") {
    return [
      item.username,
      item.quizTitle,
      item.sessionCode,
      item.studentEmail,
      getStatusLabel("students", item.status),
      item.score === null ? "—" : `${item.score}%`,
      new Date(item.joinedAt).toLocaleDateString("en-PH", {
        dateStyle: "medium",
        timeZone: "Asia/Manila",
      }),
    ];
  }

  if (item.entity === "student_accounts") {
    return [
      item.username,
      item.email,
      item.teacherUsername,
      new Date(item.createdAt).toLocaleDateString("en-PH", {
        dateStyle: "medium",
        timeZone: "Asia/Manila",
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
        timeZone: "Asia/Manila",
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
      timeZone: "Asia/Manila",
    }),
  ];
}

function shortDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-PH", {
        dateStyle: "medium",
        timeZone: "Asia/Manila",
      });
}

/** A main value with one smaller line under it, shown only on small screens. */
function WithExtra({
  children,
  extra,
  below,
}: {
  children: ReactNode;
  extra: string;
  /** The breakpoint where the extra line is no longer needed. */
  below: "sm" | "md";
}) {
  return (
    <>
      {children}
      {extra ? (
        <span
          className={`mt-0.5 block text-sm font-normal text-neutral-600 ${
            below === "sm" ? "sm:hidden" : "md:hidden"
          }`}
        >
          {extra}
        </span>
      ) : null}
    </>
  );
}

// Columns that make way on small screens. Their information moves under the
// main cell of the row (see cellFor), so nothing is lost on a phone.
const SMALL_SCREEN_HIDDEN: Partial<
  Record<SearchEntity, Record<string, string>>
> = {
  quizzes: {
    Questions: "hidden sm:table-cell",
    Created: "hidden sm:table-cell",
  },
  students: {
    Session: "hidden md:table-cell",
    Email: "hidden md:table-cell",
    Joined: "hidden sm:table-cell",
  },
  student_accounts: {
    Email: "hidden sm:table-cell",
    Created: "hidden sm:table-cell",
  },
};

function cellFor(item: SearchItem, index: number): ReactNode {
  const value = itemValues(item)[index] || "—";

  if (item.entity === "quizzes" && index === 0) {
    const count = Number(item.questionCount);
    return (
      <WithExtra
        below="sm"
        extra={`${count} ${count === 1 ? "question" : "questions"} · ${shortDate(item.createdAt)}`}
      >
        {value}
      </WithExtra>
    );
  }

  if (item.entity === "student_accounts" && index === 0) {
    return (
      <WithExtra
        below="sm"
        extra={`${item.email || ""} · Joined ${shortDate(item.createdAt)}`}
      >
        {value}
      </WithExtra>
    );
  }

  if (item.entity === "students") {
    if (index === 0) {
      return (
        <WithExtra below="md" extra={item.studentEmail || ""}>
          {value}
        </WithExtra>
      );
    }
    if (index === 1) {
      return (
        <WithExtra
          below="md"
          extra={item.sessionCode ? `Code ${item.sessionCode}` : ""}
        >
          {value}
        </WithExtra>
      );
    }
    if (index === 5) {
      return (
        <WithExtra below="sm" extra={shortDate(item.joinedAt)}>
          {value}
        </WithExtra>
      );
    }
  }

  return value;
}

/**
 * Filters a person can actually use. A teacher only sees their own records,
 * so the teacher filter is pointless, and the session code is something only
 * the app uses. Those two stay for admins.
 */
function filterKeysFor(role: SearchRole, entity: SearchEntity): SearchFilterKey[] {
  return getVisibleFilterKeys(role, entity).filter(
    (key) => !(role === "teacher" && (key === "teacher" || key === "session")),
  );
}

/** "Date" + "desc" -> one choice such as "Date: newest first". */
function sortChoiceLabel(
  field: string,
  label: string,
  direction: "asc" | "desc",
): string {
  if (field === "date") {
    return `${label}: ${direction === "desc" ? "newest first" : "oldest first"}`;
  }

  return `${label}: ${direction === "asc" ? "A to Z" : "Z to A"}`;
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
            className="pixel-input mt-0.5 h-9 w-full px-3 text-sm"
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
            className="pixel-input mt-0.5 h-9 w-full px-3 text-sm"
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
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {filterKeysFor(role, entity).map(renderFilter)}
    </div>
  );
}

export function SearchFilter({
  role,
  entity,
  toolbar,
  renderActions,
}: SearchFilterProps) {
  const {
    query,
    results,
    loading,
    error,
    updateQuery,
  } = useSearchFilters(role, entity);
  const config = getEntityConfig(entity);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Keep the last loaded page on screen while the next one loads, so moving
  // between pages (or editing a filter) never swaps the table for a loader.
  const [lastResults, setLastResults] = useState(results);
  if (results && results !== lastResults) {
    setLastResults(results);
  }
  const visibleResults = results ?? lastResults;

  function clearAllFilters() {
    updateQuery(defaultSearchQuery(role, entity));
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
  const items = visibleResults?.items ?? [];
  const pagination = results?.pagination;
  const visiblePagination = visibleResults?.pagination;

  useEffect(() => {
    if (
      !loading &&
      pagination &&
      query.page > pagination.totalPages
    ) {
      updateQuery({ page: pagination.totalPages });
    }
  }, [loading, pagination, query.page, updateQuery]);

  const sortChoices = SORT_OPTIONS.filter((option) =>
    config.sortFields.includes(option.value),
  ).flatMap((option) =>
    (option.value === "date" ? (["desc", "asc"] as const) : (["asc", "desc"] as const)).map(
      (direction) => ({
        value: `${option.value}:${direction}`,
        label: sortChoiceLabel(option.value, option.label, direction),
      }),
    ),
  );
  const filterCount = chips.filter((chip) => chip.key !== "q").length;
  const hasFilters = filterKeysFor(role, entity).length > 0;

  return (
    <section aria-label={`${config.pluralLabel} search`} className="space-y-2">
      {/* One compact row: search, sort, filters and the page's own button. */}
      <PixelCard className="space-y-2 p-2! sm:p-2.5!">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`${entity}-search`} className="sr-only">
            Search {config.pluralLabel.toLowerCase()}
          </label>
          <div className="min-w-0 flex-1 basis-40 sm:max-w-64 sm:flex-none sm:basis-64">
            <DebouncedTextInput
              key={`q-${query.q}`}
              id={`${entity}-search`}
              type="search"
              value={query.q}
              maxLength={200}
              placeholder={config.searchPlaceholder}
              className="h-9 w-full px-3 text-sm"
              onValueChange={(value) => updateQuery({ q: value })}
            />
          </div>

          <label htmlFor={`${entity}-sort`} className="sr-only">
            Sort by
          </label>
          <select
            id={`${entity}-sort`}
            value={`${query.sort}:${query.dir}`}
            onChange={(event) => {
              const [sort, dir] = event.currentTarget.value.split(":");
              updateQuery({
                sort: sort as SearchQuery["sort"],
                dir: dir as SearchQuery["dir"],
              });
            }}
            className="pixel-input h-9 min-w-0 flex-1 px-2 text-sm sm:flex-none"
          >
            {sortChoices.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>

          {hasFilters ? (
            <PixelButton
              type="button"
              variant="accent"
              size="sm"
              aria-expanded={filtersOpen}
              aria-controls={`${entity}-filters`}
              onClick={() => setFiltersOpen((open) => !open)}
              className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap"
            >
              Filters{filterCount > 0 ? ` (${filterCount})` : ""}
              {/* A solid pixel arrow: points down when closed, up when open. */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
                shapeRendering="crispEdges"
                aria-hidden="true"
                className={`h-4 w-4 shrink-0 ${filtersOpen ? "rotate-180" : ""}`}
              >
                <path d="M1 4h14v3H1zM3 7h10v3H3zM5 10h6v3H5zM7 13h2v1H7z" />
              </svg>
            </PixelButton>
          ) : null}

          {toolbar ? (
            <div className="ml-auto flex flex-wrap gap-2">{toolbar}</div>
          ) : null}
        </div>

        {filtersOpen && hasFilters ? (
          <div id={`${entity}-filters`} className="border-t-2 border-ink/20 pt-2">
            <FilterFields
              role={role}
              entity={entity}
              query={query}
              updateQuery={updateQuery}
              idPrefix={`${entity}-filter`}
            />
          </div>
        ) : null}
      </PixelCard>

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
          {chips.map((chip) => (
            <PixelBadge
              key={chip.key}
              variant="info"
              className="gap-2"
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
            </PixelBadge>
          ))}
          <button
            type="button"
            onClick={clearAllFilters}
            className="px-1 text-sm font-semibold text-ink underline"
          >
            Clear all
          </button>
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {loading
          ? "Loading search results"
          : pagination
            ? `${pagination.total} ${config.pluralLabel.toLowerCase()} found`
            : ""}
      </p>

      {loading && !visibleResults ? (
        <PixelLoader label="Loading search results..." />
      ) : null}
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-3 border-2 border-danger-dark bg-danger-surface p-3 text-sm text-danger-dark"
        >
          {error}
        </div>
      ) : null}

      {!error && visibleResults ? (
        <div
          aria-busy={loading}
          className={loading ? "pointer-events-none opacity-60 transition-opacity" : undefined}
        >
        <PaginatedTable
          caption={`${config.pluralLabel} search results`}
          columns={[
            ...resultHeaders(entity)
              .map((label, index) => ({ label, index }))
              .filter(
                ({ label }) => !(role === "teacher" && label === "Teacher"),
              )
              .map(
                ({ label, index }): PaginatedTableColumn<SearchItem> => ({
                  key: `${entity}-${index}`,
                  label,
                  render: (item) => cellFor(item, index),
                  className: `${
                    index === 0 ? "min-w-32" : "whitespace-nowrap"
                  } ${SMALL_SCREEN_HIDDEN[entity]?.[label] ?? ""}`.trim(),
                }),
              ),
            ...(renderActions
              ? [{
                  key: "actions",
                  label: "Actions",
                  render: renderActions,
                  className: "min-w-32",
                }]
              : []),
          ]}
          rows={items}
          rowKey={(item) => item.id}
          page={visiblePagination?.page ?? 1}
          totalPages={visiblePagination?.totalPages ?? 1}
          onPageChange={(page) => updateQuery({ page }, true)}
          emptyMessage="No results match your filters."
        />
        </div>
      ) : null}
    </section>
  );
}

function resultHeaders(entity: SearchEntity): string[] {
  if (entity === "students") {
    return ["Username", "Quiz", "Session", "Email", "Status", "Score", "Joined"];
  }
  if (entity === "student_accounts") {
    return ["Student", "Email", "Teacher", "Created"];
  }
  if (entity === "quizzes") {
    return ["Quiz", "Status", "Questions", "Teacher", "Created"];
  }
  return ["Teacher", "Email", "Status", "Quizzes", "Created"];
}
