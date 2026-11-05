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
  return `${columns.map((column) => csvCell(row[column.key])).join(",")}\r\n`;
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
