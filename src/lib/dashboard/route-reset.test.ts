import { describe, expect, it } from "vitest";
import { shouldResetRoute } from "./route-reset";

describe("dashboard route reset", () => {
  it("keeps filter state on the first visit in a page load", () => {
    const scope = "first-visit";

    expect(
      shouldResetRoute(
        scope,
        "/teacher-dashboard/students?q=maria",
        "/teacher-dashboard/students?entity=student_accounts",
      ),
    ).toBe(false);
    expect(
      shouldResetRoute(
        scope,
        "/teacher-dashboard/students?q=maria",
        "/teacher-dashboard/students?entity=student_accounts",
      ),
    ).toBe(false);
  });

  it("resets stale state when the section is entered again", () => {
    const scope = "back-navigation";

    expect(
      shouldResetRoute(scope, "/teacher-dashboard/students", ""),
    ).toBe(false);
    expect(
      shouldResetRoute(
        scope,
        "/teacher-dashboard/quizzes?entity=quizzes",
        "/teacher-dashboard/quizzes?entity=quizzes",
      ),
    ).toBe(false);
    expect(
      shouldResetRoute(
        scope,
        "/teacher-dashboard/students?entity=student_accounts&q=maria&page=3",
        "/teacher-dashboard/students?entity=student_accounts",
      ),
    ).toBe(true);
  });

  it("leaves a re-entered section alone when its URL is already clean", () => {
    const scope = "clean-re-entry";

    expect(
      shouldResetRoute(scope, "/student-dashboard", ""),
    ).toBe(false);
    expect(
      shouldResetRoute(
        scope,
        "/student-dashboard?tab=history",
        "/student-dashboard?tab=history",
      ),
    ).toBe(false);
  });
});
