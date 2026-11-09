import { describe, expect, it } from "vitest";
import { getActiveFilterChips } from "./active-filters";
import { applyPlanToRows } from "./mock-repository";
import { buildSearchPlan } from "./query-builder";
import { createSearchScope } from "./scope";
import { parseSearchState, serializeSearchState } from "./url-state";
import { parseSearchQuery } from "./validation";

const CLASS_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const scope = createSearchScope({ role: "teacher", userId: "teacher-auth-id" });

function classQuery() {
  return parseSearchQuery(
    new URLSearchParams(`entity=students&class=${CLASS_ID.toUpperCase()}`),
    "teacher",
  );
}

describe("class filter: validation", () => {
  it("accepts a class id and lowercases it", () => {
    expect(classQuery().class).toBe(CLASS_ID);
  });

  it("treats an empty class as no filter", () => {
    const query = parseSearchQuery(
      new URLSearchParams("entity=students&class="),
      "teacher",
    );

    expect(query.class).toBe("");
  });

  it("rejects anything that is not a class id", () => {
    expect(() =>
      parseSearchQuery(
        new URLSearchParams("entity=students&class=../teacher/students"),
        "teacher",
      ),
    ).toThrowError(expect.objectContaining({ code: "INVALID_FILTER" }));
  });

  it("is not available to admins or on other lists", () => {
    expect(() =>
      parseSearchQuery(
        new URLSearchParams(`entity=students&class=${CLASS_ID}`),
        "admin",
      ),
    ).toThrowError(expect.objectContaining({ code: "FORBIDDEN_FILTER" }));

    expect(() =>
      parseSearchQuery(
        new URLSearchParams(`entity=quizzes&class=${CLASS_ID}`),
        "teacher",
      ),
    ).toThrowError(expect.objectContaining({ code: "INVALID_FILTER" }));
  });

  it("survives a round trip through the page URL", () => {
    const query = classQuery();

    expect(parseSearchState(serializeSearchState(query), "teacher").class).toBe(
      CLASS_ID,
    );
  });
});

describe("class filter: plan", () => {
  it("keeps the teacher scope first and matches the class usernames", () => {
    const plan = buildSearchPlan(classQuery(), scope, ["maria_s", "Juan"]);

    expect(plan.filters[0]).toEqual({
      column: "teacher_id",
      operator: "eq",
      value: "teacher-auth-id",
    });
    expect(plan.filters[1]).toEqual({
      column: "username",
      operator: "ilike_any",
      value: "",
      // "_" is a LIKE wildcard, so it is escaped to match only itself.
      values: ["maria\\_s", "Juan"],
    });
  });

  it("refuses to run without the resolved usernames", () => {
    expect(() => buildSearchPlan(classQuery(), scope)).toThrowError(
      expect.objectContaining({ code: "CLASS_NOT_RESOLVED" }),
    );
  });

  it("adds nothing when no class is chosen", () => {
    const plan = buildSearchPlan(
      parseSearchQuery(new URLSearchParams("entity=students"), "teacher"),
      scope,
    );

    expect(plan.filters.some((f) => f.operator === "ilike_any")).toBe(false);
  });
});

describe("class filter: matching rows", () => {
  const rows = [
    { teacher_id: "teacher-auth-id", username: "Maria_S", joined_at: "1", participant_id: "a" },
    { teacher_id: "teacher-auth-id", username: "mariaXs", joined_at: "2", participant_id: "b" },
    { teacher_id: "teacher-auth-id", username: "juan", joined_at: "3", participant_id: "c" },
    { teacher_id: "other-teacher", username: "maria_s", joined_at: "4", participant_id: "d" },
  ];

  it("keeps only class members, ignoring case and wildcards", () => {
    const plan = buildSearchPlan(classQuery(), scope, ["maria_s"]);
    const { rows: found, total } = applyPlanToRows(rows, plan);

    expect(found.map((row) => row.participant_id)).toEqual(["a"]);
    expect(total).toBe(1);
  });

  it("matches nothing for a class with no students", () => {
    const plan = buildSearchPlan(classQuery(), scope, []);

    expect(applyPlanToRows(rows, plan).total).toBe(0);
  });
});

describe("class filter: chips", () => {
  it("shows the class name, not its id", () => {
    const chips = getActiveFilterChips(classQuery(), { [CLASS_ID]: "Rizal" });

    expect(chips).toContainEqual({ key: "class", label: "Class", value: "Rizal" });
  });
});
