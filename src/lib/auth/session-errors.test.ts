import { describe, expect, it } from "vitest";
import { isInvalidSession } from "./session-errors";

describe("isInvalidSession", () => {
  it("recognizes missing and expired sessions", () => {
    expect(isInvalidSession({ name: "AuthSessionMissingError" })).toBe(true);
    expect(isInvalidSession({ status: 400 })).toBe(true);
    expect(isInvalidSession({ status: 401 })).toBe(true);
  });

  it("does not hide service and network failures", () => {
    expect(isInvalidSession({ status: 503 })).toBe(false);
    expect(isInvalidSession({ name: "AuthUnknownError" })).toBe(false);
  });
});
