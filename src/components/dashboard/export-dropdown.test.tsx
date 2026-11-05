import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import {
  createExportSearchParams,
  EXPORT_FORMAT_OPTIONS,
  ExportDropdown,
} from "./export-dropdown";

describe("export dropdown", () => {
  it("exposes the Excel action and accessible menu trigger", () => {
    const markup = renderToStaticMarkup(
      createElement(ExportDropdown, { role: "teacher" }),
    );

    expect(markup).toContain("Download as Excel");
    expect(markup).toContain('aria-haspopup="menu"');
    expect(markup).toContain('aria-expanded="false"');
  });

  it("offers Excel before CSV in the format menu", () => {
    expect(EXPORT_FORMAT_OPTIONS.map((option) => option.label)).toEqual([
      "Download as Excel (.xlsx)",
      "Download as CSV (.csv)",
    ]);
  });

  it("preserves applicable URL filters and resets pagination for export checks", () => {
    const params = createExportSearchParams(
      "entity=students&q=maria&session=SESS-1&from=2026-09-01&page=4&pageSize=20",
      "teacher",
      "students",
    );

    expect(params.get("q")).toBe("maria");
    expect(params.get("session")).toBe("SESS-1");
    expect(params.get("from")).toBe("2026-09-01");
    expect(params.get("page")).toBe("1");
    expect(params.get("pageSize")).toBe("5");
  });

  it("does not copy incompatible filters when a different dataset is selected", () => {
    const params = createExportSearchParams(
      "entity=students&status=completed&from=2026-09-01",
      "admin",
      "quizzes",
    );

    expect(params.get("entity")).toBe("quizzes");
    expect(params.has("status")).toBe(false);
    expect(params.has("from")).toBe(false);
  });

  it("does not offer a separate participants dataset", () => {
    for (const role of ["teacher", "admin"] as const) {
      const markup = renderToStaticMarkup(
        createElement(ExportDropdown, { role }),
      );

      expect(markup).not.toContain('value="participants"');
      expect(markup).toContain('value="students"');
      expect(markup).toContain('value="student_accounts"');
    }
  });
});
