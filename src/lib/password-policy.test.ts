import { describe, expect, it } from "vitest";
import { PASSWORD_RULES, validatePassword } from "./password-policy";

describe("password policy", () => {
  it("accepts a password that meets every rule", () => {
    const validation = validatePassword("Str0ng!Pass", [
      "maria@example.com",
      "maria",
    ]);

    expect(validation.valid).toBe(true);
    expect(validation.results.every((result) => result.passed)).toBe(true);
  });

  it("reports missing character classes", () => {
    const validation = validatePassword("password");
    const failed = validation.results
      .filter((result) => !result.passed)
      .map((result) => result.id);

    expect(validation.valid).toBe(false);
    expect(failed).toEqual(
      expect.arrayContaining(["uppercase", "number", "special"]),
    );
  });

  it("rejects a password containing the email or username", () => {
    const validation = validatePassword("Maria123!", [
      "maria@example.com",
      "maria",
    ]);
    const identity = validation.results.find(
      (result) => result.id === "identity",
    );

    expect(identity?.passed).toBe(false);
    expect(validation.valid).toBe(false);
  });

  it("enforces the 72-byte limit", () => {
    expect(validatePassword("Aa1!" + "a".repeat(68)).valid).toBe(true);
    expect(validatePassword("Aa1!" + "a".repeat(69)).valid).toBe(false);
  });

  it("exposes every rule shown in the UI", () => {
    expect(PASSWORD_RULES.map((rule) => rule.id)).toEqual([
      "min-length",
      "uppercase",
      "lowercase",
      "number",
      "special",
      "max-length",
    ]);
  });
});
