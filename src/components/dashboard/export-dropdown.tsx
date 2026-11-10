"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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

// What the download contains, in words a teacher or admin would use.
const EXPORT_NOUNS: Record<SearchEntity, readonly [string, string]> = {
  quizzes: ["quiz", "quizzes"],
  students: ["student score", "student scores"],
  student_accounts: ["student account", "student accounts"],
  teachers: ["teacher", "teachers"],
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

/**
 * One small bar that downloads whatever list is on the page. There is nothing
 * to pick apart: the page decides what is exported (quizzes on View Quizzes,
 * student accounts on Manage Student Info, scores on View Scores), the current
 * search and filters are applied, and the button says how many rows to expect.
 * Pages that are not a list (Assessment, Leaderboard, Settings) show nothing.
 */
export function ExportDropdown({ role }: { role: SearchRole }) {
  const searchParams = useSearchParams();
  const routeEntity = searchParams.get("entity");
  const entity: SearchEntity | null =
    isSearchEntity(routeEntity) && EXPORT_ENTITIES[role].includes(routeEntity)
      ? routeEntity
      : role === "admin"
        ? "quizzes"
        : null;

  if (!entity) {
    return null;
  }

  return (
    <ExportPanel
      key={entity}
      role={role}
      entity={entity}
      currentSearch={searchParams.toString()}
    />
  );
}

type Availability = {
  key: string;
  state: "available" | "empty" | "error";
  total: number;
  message: string;
};

function ExportPanel({
  role,
  entity,
  currentSearch,
}: {
  role: SearchRole;
  entity: SearchEntity;
  currentSearch: string;
}) {
  const [exportingFormat, setExportingFormat] = useState<
    "csv" | "xlsx" | null
  >(null);
  const [notice, setNotice] = useState("");
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const requestParams = createExportSearchParams(currentSearch, role, entity);
  requestParams.set("format", "check");
  const requestKey = `${entity}?${requestParams.toString()}`;
  const availabilityUrl = `/api/export?${requestParams.toString()}`;
  const current = availability?.key === requestKey ? availability : null;
  const availabilityState = current?.state ?? "checking";
  const isExporting = exportingFormat !== null;
  const [singular, plural] = EXPORT_NOUNS[entity];
  const label = exportEntityLabel(entity);

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
          total: body.total,
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
          total: 0,
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

    setExportingFormat(format);
    setNotice("");
    const controller = createSessionRequestController();

    try {
      const params = createExportSearchParams(currentSearch, role, entity);
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
      anchor.download = getExportFilename(entity, format);
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setNotice(`${label} downloaded. Check your Downloads folder.`);
      setNoticeIsError(false);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Unable to download export.",
      );
      setNoticeIsError(true);
    } finally {
      releaseSessionRequestController(controller);
      setExportingFormat(null);
    }
  }

  const exportDisabled = availabilityState !== "available" || isExporting;
  const caption =
    availabilityState === "checking"
      ? "Checking what is available..."
      : availabilityState === "empty"
        ? "Nothing to download yet."
        : availabilityState === "error"
          ? (current?.message ?? "Unable to check export availability.")
          : `${current?.total ?? 0} ${current?.total === 1 ? singular : plural} ready. Your current search and filters are applied.`;
  const buttonBase =
    "inline-flex min-h-10 items-center justify-center gap-2 border-2 px-3 py-2 text-sm font-semibold focus-visible:ring-2 disabled:cursor-not-allowed";

  return (
    <section
      aria-label={`Download ${plural}`}
      className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-2 border-2 border-ink bg-surface px-3 py-2 shadow-[3px_3px_0_var(--color-ink)] sm:w-auto sm:max-w-xl"
    >
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-sm font-bold text-foreground">Download {plural}</p>
        <p
          role={availabilityState === "error" ? "alert" : "status"}
          className={`text-sm leading-snug ${
            availabilityState === "error"
              ? "text-danger-dark"
              : "text-neutral-700"
          }`}
        >
          {caption}
        </p>
      </div>

      <div className="flex w-full gap-2 sm:w-auto">
        <button
          type="button"
          disabled={exportDisabled}
          title="Opens in Excel or Google Sheets. Best for most people."
          onClick={() => void download("xlsx")}
          className={`${buttonBase} flex-1 border-emerald-900 bg-emerald-600 text-px-text-dark hover:bg-emerald-500 active:bg-emerald-700 focus-visible:ring-emerald-300 disabled:bg-emerald-900/40 disabled:text-emerald-200/50 sm:flex-none`}
        >
          <span
            aria-hidden="true"
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center"
          >
            {exportingFormat === "xlsx" ? <Spinner className="h-4 w-4" /> : "↓"}
          </span>
          Excel
        </button>
        <button
          type="button"
          disabled={exportDisabled}
          title="A plain-text file that other programs can read."
          onClick={() => void download("csv")}
          className={`${buttonBase} flex-1 border-ink bg-surface text-ink hover:bg-neutral-100 active:bg-neutral-200 focus-visible:ring-neutral-400 disabled:bg-neutral-100 disabled:text-neutral-400 sm:flex-none`}
        >
          <span
            aria-hidden="true"
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center"
          >
            {exportingFormat === "csv" ? <Spinner className="h-4 w-4" /> : "↓"}
          </span>
          CSV
        </button>
      </div>

      {isExporting ? (
        <span role="status" className="sr-only">
          Preparing your download
        </span>
      ) : null}
      {notice ? (
        <p
          role={noticeIsError ? "alert" : "status"}
          className={`fixed bottom-4 left-1/2 z-[70] flex w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 items-start justify-between gap-3 border-2 p-3 text-sm shadow-[3px_3px_0_var(--color-ink)] ${
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
    </section>
  );
}
