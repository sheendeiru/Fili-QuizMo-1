"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
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
      className="mt-1 h-10 w-full px-3 text-sm"
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
            className="pixel-input mt-1 h-10 w-full px-3 text-sm"
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
            className="pixel-input mt-1 h-10 w-full px-3 text-sm"
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

  useEffect(() => {
    if (
      !loading &&
      pagination &&
      query.page > pagination.totalPages
    ) {
      updateQuery({ page: pagination.totalPages });
    }
  }, [loading, pagination, query.page, updateQuery]);

  return (
    <section aria-label={`${config.pluralLabel} search`} className="space-y-3">
      <PixelCard className="space-y-3">
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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <PixelButton
            type="button"
            variant="neutral"
            size="sm"
            ref={mobileFilterButtonRef}
            className="md:hidden"
            aria-expanded={mobileFiltersOpen}
            aria-controls={`${entity}-mobile-filters`}
            onClick={() => setMobileFiltersOpen(true)}
          >
            Show filters
          </PixelButton>
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
              className="pixel-input h-9 px-2 text-sm"
            >
              {SORT_OPTIONS.filter((option) =>
                config.sortFields.includes(option.value),
              ).map((option) => (
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
              className="pixel-input h-9 px-2 text-sm"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
          <PixelButton
            type="button"
            variant="accent"
            size="sm"
            onClick={clearAllFilters}
            disabled={chips.length === 0}
          >
            Clear all filters
          </PixelButton>
        </div>

            <div className="hidden md:block">
          <FilterFields
            role={role}
            entity={entity}
            query={query}
            updateQuery={updateQuery}
            idPrefix={`${entity}-desktop`}
          />
        </div>
      </PixelCard>

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
            className="ml-auto h-full w-full max-w-sm overflow-y-auto border-2 border-ink bg-surface p-3 text-ink shadow-[3px_3px_0_var(--color-ink)]"
          >
            <div className="mb-5 flex items-center justify-between">
              <h3
                id={`${entity}-mobile-filters-title`}
                className="text-lg font-semibold"
              >
                Filters
              </h3>
              <PixelButton
                type="button"
                variant="neutral"
                size="sm"
                autoFocus
                onClick={closeMobileFilters}
              >
                Close filters
              </PixelButton>
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
          className="flex items-start gap-3 border-2 border-danger-dark bg-danger-surface p-3 text-sm text-danger-dark"
        >
          {error}
        </div>
      ) : null}

      {toolbar ? (
        <div className="flex flex-wrap justify-end gap-2">{toolbar}</div>
      ) : null}

      {!loading && !error && results ? (
        <PaginatedTable
          caption={`${config.pluralLabel} search results`}
          columns={[
            ...resultHeaders(entity).map(
              (label, index): PaginatedTableColumn<SearchItem> => ({
                key: `${entity}-${index}`,
                label,
                render: (item) => itemValues(item)[index] || "—",
                className: "whitespace-nowrap",
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
          page={pagination?.page ?? 1}
          totalPages={pagination?.totalPages ?? 1}
          onPageChange={(page) => updateQuery({ page }, true)}
          emptyMessage="No results match your filters."
        />
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
