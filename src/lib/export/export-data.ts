import type { SearchEntity, SearchRow } from "@/lib/search/types";

export type ExportColumn = {
  key: string;
  label: string;
  type?: "number" | "date";
};

export const EXPORT_COLUMNS: Record<SearchEntity, readonly ExportColumn[]> = {
  quizzes: [
    { key: "title", label: "Quiz title" },
    { key: "status", label: "Status" },
    { key: "question_count", label: "Question count", type: "number" },
    { key: "teacher_username", label: "Teacher" },
    { key: "created_at", label: "Created at", type: "date" },
  ],
  students: [
    { key: "username", label: "Student username" },
    { key: "quiz_title", label: "Quiz" },
    { key: "session_code", label: "Session code" },
    { key: "student_email", label: "Student email" },
    { key: "status", label: "Status" },
    { key: "score", label: "Score", type: "number" },
    { key: "teacher_username", label: "Teacher" },
    { key: "joined_at", label: "Joined at", type: "date" },
  ],
  student_accounts: [
    { key: "username", label: "Student username" },
    { key: "email", label: "Email" },
    { key: "teacher_username", label: "Teacher" },
    { key: "created_at", label: "Created at", type: "date" },
  ],
  teachers: [
    { key: "username", label: "Teacher" },
    { key: "email", label: "Email" },
    { key: "status", label: "Account status" },
    { key: "quiz_count", label: "Quiz count", type: "number" },
    { key: "created_at", label: "Created at", type: "date" },
  ],
};

// Dates are exported as calendar dates (no time, no UTC offset), in the
// same time zone the app shows to users, so a quiz created at 23:27 UTC on
// Oct 31 is listed as 2026-11-01 (it is already Nov 1 in the Philippines).
export const EXPORT_TIME_ZONE = "Asia/Manila";

const exportDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: EXPORT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function exportDateParts(
  value: unknown,
): { year: number; month: number; day: number } | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = exportDateFormat.formatToParts(date);
  const pick = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);

  return { year: pick("year"), month: pick("month"), day: pick("day") };
}

/** "2026-11-01", or "" when the value is empty or not a valid date. */
export function formatExportDate(value: unknown): string {
  const parts = exportDateParts(value);
  if (!parts) {
    return "";
  }

  const { year, month, day } = parts;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * A Date at 00:00 UTC on that calendar day, for real Excel date cells.
 * ExcelJS writes dates by their UTC value, so this shows the exact day.
 */
export function toExportDateOnly(value: unknown): Date | null {
  const parts = exportDateParts(value);
  return parts
    ? new Date(Date.UTC(parts.year, parts.month - 1, parts.day))
    : null;
}

export function safeSpreadsheetText(value: string): string {
  return /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value;
}

function csvCell(value: unknown): string {
  const text =
    value === null || value === undefined
      ? ""
      : typeof value === "string"
        ? safeSpreadsheetText(value)
        : value instanceof Date
          ? value.toISOString()
          : String(value);

  return `"${text.replace(/"/g, '""')}"`;
}

export function serializeCsvHeader(
  columns: readonly ExportColumn[],
): string {
  return `\uFEFF${columns.map((column) => csvCell(column.label)).join(",")}\r\n`;
}

export function serializeCsvRow(
  row: SearchRow,
  columns: readonly ExportColumn[],
): string {
  return `${columns
    .map((column) =>
      csvCell(
        column.type === "date"
          ? formatExportDate(row[column.key])
          : row[column.key],
      ),
    )
    .join(",")}\r\n`;
}

export function serializeCsv(
  rows: readonly SearchRow[],
  columns: readonly ExportColumn[],
): string {
  return `${serializeCsvHeader(columns)}${rows
    .map((row) => serializeCsvRow(row, columns))
    .join("")}`;
}

export async function* paginateExportRows(input: {
  firstRows: SearchRow[];
  total: number;
  batchSize: number;
  signal: AbortSignal;
  fetchPage: (from: number, to: number) => Promise<SearchRow[]>;
}): AsyncGenerator<SearchRow> {
  for (const row of input.firstRows) {
    yield row;
  }

  for (
    let offset = input.batchSize;
    offset < input.total;
    offset += input.batchSize
  ) {
    if (input.signal.aborted) {
      return;
    }

    const expectedRows = Math.min(input.batchSize, input.total - offset);
    const rows = await input.fetchPage(offset, offset + expectedRows - 1);

    if (rows.length !== expectedRows) {
      throw new Error("Export pagination returned an incomplete page.");
    }

    for (const row of rows) {
      yield row;
    }
  }
}

export function getExportFilename(
  entity: SearchEntity,
  format: "csv" | "xlsx",
  date = new Date(),
): string {
  const dateStamp = date.toISOString().slice(0, 10);
  return `fili-quizmo-${entity}-${dateStamp}.${format}`;
}
