"use client";

import { useId, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { KeyboardEvent } from "react";
import { Spinner } from "@/components/ui/spinner";
import { getVisibleFilterKeys } from "@/lib/search/config";
import { SEARCH_ENTITIES, type SearchEntity, type SearchRole } from "@/lib/search/types";
import { getExportFilename } from "@/lib/export/export-data";
import {
  createSessionRequestController,
  expireSessionAndRedirect,
  releaseSessionRequestController,
} from "@/lib/auth/session-state";

const EXPORT_ENTITIES: Record<SearchRole, readonly SearchEntity[]> = {
  teacher: ["quizzes", "students", "student_accounts"],
  admin: ["quizzes", "students", "student_accounts", "teachers"],
};

const EXPORT_ENTITY_LABELS: Partial<Record<SearchEntity, string>> = {
  student_accounts: "Student accounts",
  // "students" is the quiz roster with scores (search_participants), not the
  // account list, so the plain label was easy to confuse with the one above.
  students: "Student scores",
};

function exportEntityLabel(entity: SearchEntity): string {
  return (
    EXPORT_ENTITY_LABELS[entity] ??
    entity.charAt(0).toUpperCase() + entity.slice(1)
  );
}

export const EXPORT_FORMAT_OPTIONS = [
  { format: "xlsx", label: "Download as Excel (.xlsx)" },
  { format: "csv", label: "Download as CSV (.csv)" },
] as const;

function isSearchEntity(value: string | null): value is SearchEntity {
  return value !== null && SEARCH_ENTITIES.includes(value as SearchEntity);
}

export function createExportSearchParams(
  currentSearch: string,
  role: SearchRole,
  entity: SearchEntity,
): URLSearchParams {
  const current = new URLSearchParams(currentSearch);
  const params = new URLSearchParams({ entity });
  const currentEntity = current.get("entity") ?? "quizzes";
  const searchText = current.get("q");

  if (searchText) {
    params.set("q", searchText);
  }

  if (currentEntity === entity) {
    for (const key of getVisibleFilterKeys(role, entity)) {
      const value = current.get(key);
      if (value) {
        params.set(key, value);
      }
    }

    const sort = current.get("sort");
    if (sort === "name" || sort === "date" || sort === "status") {
      params.set("sort", sort);
    }

    const direction = current.get("dir");
    if (direction === "asc" || direction === "desc") {
      params.set("dir", direction);
    }
  }

  params.set("page", "1");
  params.set("pageSize", "5");
  return params;
}

function sessionExpiredPath(role: SearchRole): string {
  return role === "teacher"
    ? "/teacher-login?status=session_expired"
    : "/admin-login?status=session_expired";
}

// A signed-out request can be redirected to an HTML login page. That is not
// JSON, so reading it must not throw a confusing "Unexpected token <" error.
async function readJsonBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function errorMessageFromResponse(status: number, body: unknown): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "object" &&
    body.error !== null &&
    "message" in body.error &&
    typeof body.error.message === "string"
  ) {
    return body.error.message;
  }

  if (status === 403) {
    return "You do not have permission to export this data.";
  }

  return `Export failed (${status}). Please try again.`;
}

export function ExportDropdown({ role }: { role: SearchRole }) {
  const searchParams = useSearchParams();
  const instanceId = useId();
  const currentSearch = searchParams.toString();
  const routeEntity = searchParams.get("entity");
  const preferredEntity =
    isSearchEntity(routeEntity) &&
    EXPORT_ENTITIES[role].includes(routeEntity)
      ? routeEntity
      : "quizzes";
  const [selection, setSelection] = useState<{
    routeEntity: SearchEntity;
    selectedEntity: SearchEntity;
  }>({ routeEntity: preferredEntity, selectedEntity: preferredEntity });
  const selectedEntity =
    selection.routeEntity === preferredEntity
      ? selection.selectedEntity
      : preferredEntity;
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<"csv" | "xlsx">("xlsx");
  const [isExporting, setIsExporting] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [availability, setAvailability] = useState<{
    key: string;
    state: "available" | "empty" | "error";
    message: string;
  } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = `export-menu-${instanceId}`;
  const requestParams = createExportSearchParams(
    currentSearch,
    role,
    selectedEntity,
  );
  requestParams.set("format", "check");
  const requestKey = `${selectedEntity}?${requestParams.toString()}`;
  const availabilityUrl = `/api/export?${requestParams.toString()}`;
  const availabilityState =
    availability?.key === requestKey ? availability.state : "checking";
  const availabilityMessage =
    availability?.key === requestKey ? availability.message : "";
  const selectedLabel = exportEntityLabel(selectedEntity);

  useEffect(() => {
    const controller = createSessionRequestController();

    fetch(availabilityUrl, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (response.redirected || response.status === 401) {
          await expireSessionAndRedirect(sessionExpiredPath(role));
          return;
        }

        const body = await readJsonBody(response);

        if (!response.ok) {
          throw new Error(errorMessageFromResponse(response.status, body));
        }

        if (
          typeof body !== "object" ||
          body === null ||
          !("total" in body) ||
          typeof body.total !== "number"
        ) {
          throw new Error("Unable to check whether matching records exist.");
        }

        setAvailability({
          key: requestKey,
          state: body.total > 0 ? "available" : "empty",
          message: "",
        });
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        setAvailability({
          key: requestKey,
          state: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to check export availability.",
        });
      })
      .finally(() => releaseSessionRequestController(controller));

    return () => controller.abort();
  }, [availabilityUrl, requestKey, role]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    menuItemRefs.current[0]?.focus();
    function closeOutside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !wrapperRef.current?.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [menuOpen]);

  useEffect(() => {
    if (!notice || noticeIsError) {
      return;
    }

    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice, noticeIsError]);

  async function download(format: "csv" | "xlsx") {
    if (availabilityState !== "available" || isExporting) {
      return;
    }

    setIsExporting(true);
    setNotice("");
    const controller = createSessionRequestController();

    try {
      const params = createExportSearchParams(
        currentSearch,
        role,
        selectedEntity,
      );
      params.set("format", format);
      const response = await fetch(`/api/export?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });

      if (response.redirected || response.status === 401) {
        await expireSessionAndRedirect(sessionExpiredPath(role));
        return;
      }

      if (!response.ok) {
        const body = await readJsonBody(response);

        throw new Error(errorMessageFromResponse(response.status, body));
      }

      const file = await response.blob();
      const url = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = getExportFilename(selectedEntity, format);
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setNotice(`${selectedLabel} export downloaded.`);
      setNoticeIsError(false);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to download export.",
      );
      setNoticeIsError(true);
    } finally {
      releaseSessionRequestController(controller);
      setIsExporting(false);
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const currentIndex = menuItemRefs.current.findIndex(
      (item) => item === document.activeElement,
    );

    if (event.key === "Escape") {
      event.preventDefault();
      setMenuOpen(false);
      menuButtonRef.current?.focus();
      return;
    }

    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % EXPORT_FORMAT_OPTIONS.length;
    } else if (event.key === "ArrowUp") {
      nextIndex =
        (currentIndex - 1 + EXPORT_FORMAT_OPTIONS.length) %
        EXPORT_FORMAT_OPTIONS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = EXPORT_FORMAT_OPTIONS.length - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      menuItemRefs.current[nextIndex]?.focus();
    }
  }

  const exportDisabled =
    availabilityState !== "available" || isExporting;
  const disabledLabel =
    availabilityState === "empty"
      ? "No matching records to export."
      : availabilityState === "error"
        ? availabilityMessage
        : "Checking for matching records.";

  return (
    <div
      ref={wrapperRef}
      className="relative flex flex-wrap items-center gap-2"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setMenuOpen(false);
        }
      }}
    >
      <label htmlFor={`export-entity-${instanceId}`} className="sr-only">
        Data to export
      </label>
      <select
        id={`export-entity-${instanceId}`}
        value={selectedEntity}
        onChange={(event) => {
          const value = event.currentTarget.value;
          if (isSearchEntity(value) && EXPORT_ENTITIES[role].includes(value)) {
            setSelection({
              routeEntity: preferredEntity,
              selectedEntity: value,
            });
            setNotice("");
          }
        }}
        className="min-w-0 flex-1 border border-border bg-surface px-2 py-2 text-sm text-foreground sm:max-w-40 sm:flex-none"
      >
        {EXPORT_ENTITIES[role].map((entity) => (
          <option key={entity} value={entity}>
            {exportEntityLabel(entity)}
          </option>
        ))}
      </select>

      <div className="inline-flex">
        <button
          type="button"
          disabled={exportDisabled}
          title={exportDisabled ? disabledLabel : "Download the current dataset as an Excel workbook"}
          onClick={() => void download("xlsx")}
          className="inline-flex items-center gap-2 border-2 border-emerald-900 bg-emerald-600 px-3 py-2 text-xs font-semibold text-px-text-dark hover:bg-emerald-500 active:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:bg-emerald-900/40 disabled:text-emerald-200/50"
        >
          <span
            aria-hidden="true"
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center"
          >
            {isExporting ? <Spinner className="h-4 w-4" /> : "↓"}
          </span>
          Download as Excel
        </button>
        <button
          ref={menuButtonRef}
          type="button"
          disabled={exportDisabled}
          aria-label="Export format options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          title={exportDisabled ? disabledLabel : "More export formats"}
          onClick={() => setMenuOpen((open) => !open)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setMenuOpen(true);
            }
          }}
          className="border-2 border-l-2 border-l-emerald-800 border-emerald-900 bg-emerald-600 px-3 py-2 text-px-text-dark hover:bg-emerald-500 active:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:bg-emerald-900/40 disabled:text-emerald-200/50"
        >
          <span aria-hidden="true">▾</span>
        </button>
      </div>

      {menuOpen ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Export format"
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 top-full z-30 mt-2 min-w-56 border-2 border-ink bg-ink p-1 text-px-gold shadow-lg"
        >
          {EXPORT_FORMAT_OPTIONS.map((option, index) => (
            <button
              key={option.format}
              ref={(element) => {
                menuItemRefs.current[index] = element;
              }}
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setSelectedFormat(option.format);
                void download(option.format);
              }}
              aria-current={selectedFormat === option.format ? "true" : undefined}
             className={`flex w-full items-center gap-2 border-l-4 px-3 py-2 text-left text-xs text-px-gold hover:bg-px-gold hover:text-ink focus-visible:bg-px-gold focus-visible:text-ink ${
              selectedFormat === option.format
                ? "border-l-px-gold bg-surface/10"
                : "border-l-transparent"
                 }`}
                >
                <span className="w-3 text-px-gold" aria-hidden="true">
                  {selectedFormat === option.format ? "✓" : ""}
                 </span>
            {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {availabilityState === "checking" || isExporting ? (
        <span role="status" className="sr-only">
          {isExporting ? "Preparing export" : "Checking export availability"}
        </span>
      ) : null}
      {availabilityState === "error" ? (
        <p
          role="alert"
          className="absolute right-0 top-full z-20 mt-2 w-72 max-w-full border-2 border-red-400 bg-red-950 p-3 text-xs text-red-200"
        >
          {availabilityMessage}
        </p>
      ) : null}
      {notice ? (
        <p
          role={noticeIsError ? "alert" : "status"}
          className={`fixed bottom-4 left-1/2 z-[70] flex w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 items-start justify-between gap-3 border-2 p-3 text-xs shadow-[3px_3px_0_var(--color-ink)] ${
            noticeIsError
              ? "border-red-400 bg-red-950 text-red-200"
              : "border-emerald-400 bg-emerald-950 text-emerald-100"
          }`}
        >
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => setNotice("")}
            className="font-bold"
          >
            ×
          </button>
        </p>
      ) : null}
    </div>
  );
}
