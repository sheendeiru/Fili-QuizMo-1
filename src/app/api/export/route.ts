import { PassThrough, Readable } from "node:stream";
import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  resolveSearchContext,
  type SearchAuthClient,
} from "@/lib/search/auth";
import {
  createAccountRoleLookup,
  resolveAccountAccess,
} from "@/lib/auth/roles";
import { SearchError, isSearchError } from "@/lib/search/errors";
import { buildSearchPlan } from "@/lib/search/query-builder";
import { SupabaseSearchRepository } from "@/lib/search/supabase-repository";
import { parseSearchQuery } from "@/lib/search/validation";
import type { SearchPlan, SearchRepository, SearchRow } from "@/lib/search/types";
import {
  EXPORT_COLUMNS,
  getExportFilename,
  paginateExportRows,
  safeSpreadsheetText,
  serializeCsvHeader,
  serializeCsvRow,
  type ExportColumn,
} from "@/lib/export/export-data";

const BATCH_SIZE = 1_000;
const MAX_EXPORT_ROWS = 100_000;
const encoder = new TextEncoder();

function errorResponse(error: SearchError): Response {
  return Response.json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    },
    {
      status: error.status,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

function createAuthClient(supabase: Awaited<ReturnType<typeof createClient>>) {
  const authClient: SearchAuthClient = {
    auth: {
      getUser: () => supabase.auth.getUser(),
      mfa: {
        getAuthenticatorAssuranceLevel: () =>
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      },
    },
    resolveAccess: (user) =>
      resolveAccountAccess(createAccountRoleLookup(supabase), user),
  };

  return authClient;
}

function exportRows(
  repository: SearchRepository,
  plan: SearchPlan,
  firstRows: SearchRow[],
  total: number,
  signal: AbortSignal,
): AsyncGenerator<SearchRow> {
  return paginateExportRows({
    firstRows,
    total,
    batchSize: BATCH_SIZE,
    signal,
    async fetchPage(from, to) {
      const result = await repository.search({
        ...plan,
        range: { from, to },
      });
      return result.rows;
    },
  });
}

function cellValue(row: SearchRow, column: ExportColumn): string | number | Date | null {
  const value = row[column.key];

  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (column.type === "number") {
    const numberValue = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  if (column.type === "date") {
    const dateValue = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(dateValue.getTime()) ? null : dateValue;
  }

  const text = typeof value === "string" ? value : String(value);
  return safeSpreadsheetText(text);
}

function csvStream(
  repository: SearchRepository,
  plan: SearchPlan,
  firstRows: SearchRow[],
  total: number,
  columns: readonly ExportColumn[],
  signal: AbortSignal,
): ReadableStream<Uint8Array> {
  const source = Readable.from(
    (async function* () {
      try {
        yield encoder.encode(serializeCsvHeader(columns));

        for await (const row of exportRows(
          repository,
          plan,
          firstRows,
          total,
          signal,
        )) {
          yield encoder.encode(serializeCsvRow(row, columns));
        }
      } catch (error) {
        console.error("CSV export stream failed.", error);
        throw error;
      }
    })(),
  );

  return Readable.toWeb(source) as ReadableStream<Uint8Array>;
}

async function excelStream(
  repository: SearchRepository,
  plan: SearchPlan,
  firstRows: SearchRow[],
  total: number,
  columns: readonly ExportColumn[],
  signal: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const { default: ExcelJS } = await import("exceljs");
  const output = new PassThrough();
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: output,
    useStyles: true,
  });
  const worksheet = workbook.addWorksheet("Fili-QuizMo export");

  worksheet.columns = columns.map((column) => ({
    key: column.key,
    width: Math.min(Math.max(column.label.length + 4, 14), 36),
  }));
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  const header = worksheet.addRow(columns.map((column) => column.label));
  header.font = { bold: true };
  header.commit();

  void (async () => {
    try {
      for await (const row of exportRows(
        repository,
        plan,
        firstRows,
        total,
        signal,
      )) {
        const excelRow = worksheet.addRow(
          columns.map((column) => cellValue(row, column)),
        );

        columns.forEach((column, index) => {
          if (column.type === "date") {
            excelRow.getCell(index + 1).numFmt = "yyyy-mm-dd hh:mm";
          }
        });

        excelRow.commit();
      }

      await workbook.commit();
    } catch (error) {
      console.error("Excel export stream failed.", error);
      output.destroy(
        error instanceof Error ? error : new Error("Excel export failed."),
      );
    }
  })();

  return Readable.toWeb(output) as ReadableStream<Uint8Array>;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const supabase = await createClient();
    const context = await resolveSearchContext(createAuthClient(supabase));
    const url = new URL(request.url);
    const format = url.searchParams.get("format") ?? "xlsx";

    if (format !== "xlsx" && format !== "csv" && format !== "check") {
      throw new SearchError(
        400,
        "INVALID_EXPORT_FORMAT",
        "Choose a supported export format.",
        { format },
      );
    }

    const query = parseSearchQuery(url.searchParams, context.role);
    const pageLimit = format === "check" ? 1 : BATCH_SIZE;
    const exportQuery = { ...query, page: 1, pageSize: pageLimit };
    const plan = buildSearchPlan(exportQuery, context);
    plan.range = { from: 0, to: pageLimit - 1 };

    const repository = new SupabaseSearchRepository(supabase);
    const firstPage = await repository.search(plan);

    if (firstPage.total > MAX_EXPORT_ROWS) {
      throw new SearchError(
        413,
        "EXPORT_TOO_LARGE",
        `This export contains more than ${MAX_EXPORT_ROWS.toLocaleString()} rows. Narrow the filters and try again.`,
        { maxRows: MAX_EXPORT_ROWS },
      );
    }

    if (firstPage.rows.length < Math.min(firstPage.total, pageLimit)) {
      throw new SearchError(
        503,
        "EXPORT_INCOMPLETE",
        "The export data could not be paginated completely. Please try again.",
      );
    }

    if (format === "check") {
      return Response.json(
        { total: firstPage.total },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const entity = exportQuery.entity;
    const filename = getExportFilename(entity, format);
    const columns = EXPORT_COLUMNS[entity];
    const stream =
      format === "csv"
        ? csvStream(
            repository,
            plan,
            firstPage.rows,
            firstPage.total,
            columns,
            request.signal,
          )
        : await excelStream(
            repository,
            plan,
            firstPage.rows,
            firstPage.total,
            columns,
            request.signal,
          );

    return new Response(stream, {
      headers: {
        "Content-Type":
          format === "csv"
            ? "text/csv; charset=utf-8"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    unstable_rethrow(error);

    if (isSearchError(error)) {
      return errorResponse(error);
    }

    console.error("Export API request failed.", error);
    return errorResponse(
      new SearchError(
        500,
        "EXPORT_REQUEST_FAILED",
        "Unable to generate this export.",
      ),
    );
  }
}
