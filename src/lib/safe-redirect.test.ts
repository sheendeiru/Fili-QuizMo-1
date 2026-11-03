import { describe, expect, it } from "vitest";
import { safeInternalPath } from "./safe-redirect";

describe("safeInternalPath", () => {
  it.each([
    "/teacher-dashboard",
    "/change-password?returnTo=%2Fstudent-login",
    "/terms#privacy",
  ])("accepts internal path %s", (path) => {
    expect(safeInternalPath(path)).toBe(path);
  });

  it.each([
    null,
    undefined,
    "",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/path\\to",
    "/return?next=https://evil.example",
    "teacher-login",
  ])("rejects unsafe path %s", (path) => {
    expect(safeInternalPath(path)).toBeNull();
  });
});
