import { describe, expect, it } from "vitest";
import { buildSearchPlan } from "./query-builder";
import { createSearchScope } from "./scope";
import { defaultSearchQuery } from "./url-state";
import { parseSearchQuery } from "./validation";

describe("buildSearchPlan", () => {
  it("adds a trusted teacher scope before user filters", () => {
    const query = defaultSearchQuery("teacher", "students");
    query.page = 3;
    query.pageSize = 10;

    const plan = buildSearchPlan(
      query,
      createSearchScope({ role: "teacher", userId: "teacher-auth-id" }),
    );

    expect(plan.filters[0]).toEqual({
      column: "teacher_id",
      operator: "eq",
      value: "teacher-auth-id",
    });
    expect(plan.range).toEqual({ from: 20, to: 29 });
    expect(plan.order[0]).toEqual({
      column: "joined_at",
      ascending: false,
    });
  });

  it("rejects a missing teacher scope", () => {
    expect(() =>
      buildSearchPlan(defaultSearchQuery("teacher", "students"), {
        role: "teacher",
        userId: "teacher-auth-id",
        teacherId: null,
        teacherLabel: null,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "SCOPE_REQUIRED" }),
    );
  });

  it("scopes students by the quiz owner", () => {
    const query = parseSearchQuery(
      new URLSearchParams("entity=students&status=completed"),
      "teacher",
    );
    const plan = buildSearchPlan(
      query,
      createSearchScope({ role: "teacher", userId: "teacher-auth-id" }),
    );

    expect(plan.filters[0]).toEqual({
      column: "teacher_id",
      operator: "eq",
      value: "teacher-auth-id",
    });
  });

  it("allows an admin to narrow students by teacher username", () => {
    const query = parseSearchQuery(
      new URLSearchParams("entity=students&teacher=msantos"),
      "admin",
    );
    const plan = buildSearchPlan(
      query,
      createSearchScope({ role: "admin", userId: "admin-id" }),
    );

    expect(plan.filters[0]).toEqual({
      column: "teacher_username",
      operator: "ilike",
      value: "%msantos%",
    });
  });

  it("rejects the admin-only teacher filter for teachers", () => {
    expect(() =>
      parseSearchQuery(
        new URLSearchParams("entity=students&teacher=msantos"),
        "teacher",
      ),
    ).toThrowError(
      expect.objectContaining({ code: "FORBIDDEN_FILTER" }),
    );
  });

  it("escapes wildcard characters in partial-match input", () => {
    const query = defaultSearchQuery("admin", "quizzes");
    query.q = "100%_safe";

    const plan = buildSearchPlan(
      query,
      createSearchScope({ role: "admin", userId: "admin-id" }),
    );

    expect(plan.search?.pattern).toBe("%100\\%\\_safe%");
  });

  it("caps page size and validates the requested sort field", () => {
    const parsed = parseSearchQuery(
      new URLSearchParams("entity=quizzes&pageSize=500&sort=name"),
      "admin",
    );

    expect(parsed.pageSize).toBe(5);
    expect(parsed.sort).toBe("name");
    expect(() =>
      parseSearchQuery(
        new URLSearchParams("entity=quizzes&sort=teacher_id"),
        "admin",
      ),
    ).toThrowError(
      expect.objectContaining({ code: "INVALID_SORT" }),
    );
  });

  it("rejects a sort field the entity does not support", () => {
    expect(() =>
      parseSearchQuery(
        new URLSearchParams("entity=student_accounts&sort=status"),
        "admin",
      ),
    ).toThrowError(
      expect.objectContaining({ code: "INVALID_SORT" }),
    );
  });

  it("does not allow passwords to be requested as a searchable field", () => {
    expect(() =>
      parseSearchQuery(
        new URLSearchParams("entity=students&password=secret"),
        "admin",
      ),
    ).toThrowError(
      expect.objectContaining({ code: "PASSWORD_NOT_SEARCHABLE" }),
    );
  });
});
