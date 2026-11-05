import { describe, expect, it } from "vitest";
import {
  getExportFilename,
  paginateExportRows,
  safeSpreadsheetText,
  serializeCsv,
} from "./export-data";

describe("export data formatting", () => {
  it("writes a UTF-8 BOM and quotes commas, quotes, and newlines", () => {
    const csv = serializeCsv(
      [{ name: 'Santos, "Maria"\nReyes' }],
      [{ key: "name", label: "Student name" }],
    );

    expect(csv).toBe(
      '\uFEFF"Student name"\r\n"Santos, ""Maria""\nReyes"\r\n',
    );
  });

  it.each(["=1+1", "+SUM(A1:A2)", "-1+2", "@HYPERLINK(url)"])(
    "neutralizes formula-like values beginning with %s",
    (value) => {
      expect(safeSpreadsheetText(value)).toBe(`'${value}`);
    },
  );

  it("keeps safe text unchanged and creates date-stamped filenames", () => {
    expect(safeSpreadsheetText("Fili-QuizMo")).toBe("Fili-QuizMo");
    expect(
      getExportFilename("students", "xlsx", new Date("2026-11-01T00:00:00Z")),
    ).toBe("fili-quizmo-students-2026-11-01.xlsx");
  });

  it("paginates complete exports beyond the Supabase 1000-row limit", async () => {
    const rows = Array.from({ length: 2_001 }, (_, index) => ({ id: index }));
    const fetchedRanges: Array<[number, number]> = [];
    const exported: number[] = [];

    for await (const row of paginateExportRows({
      firstRows: rows.slice(0, 1_000),
      total: rows.length,
      batchSize: 1_000,
      signal: new AbortController().signal,
      async fetchPage(from, to) {
        fetchedRanges.push([from, to]);
        return rows.slice(from, to + 1);
      },
    })) {
      exported.push(Number(row.id));
    }

    expect(fetchedRanges).toEqual([
      [1_000, 1_999],
      [2_000, 2_000],
    ]);
    expect(exported).toHaveLength(2_001);
    expect(exported.at(-1)).toBe(2_000);
  });
});
