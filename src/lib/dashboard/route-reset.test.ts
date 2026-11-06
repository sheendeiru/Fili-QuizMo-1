import { describe, expect, it } from "vitest";
import { takeRouteReset } from "./route-reset";

describe("dashboard route reset", () => {
  it("keeps filter state on the first visit and while editing filters", () => {
    const scope = "first-visit";

    expect(
      takeRouteReset(
        scope,
        "/teacher-dashboard/students",
        "/teacher-dashboard/students?q=maria",
        "/teacher-dashboard/students?entity=student_accounts",
      ),
    ).toBeNull();

    expect(
      takeRouteReset(
        scope,
        "/teacher-dashboard/students",
        "/teacher-dashboard/students?q=maria",
        "/teacher-dashboard/students?entity=student_accounts",
      ),
    ).toBeNull();
  });

  it("resets the URL when the section is entered from another route", () => {
    const scope = "back-navigation";

    takeRouteReset(scope, "/teacher-dashboard/students", "", "");
    expect(
      takeRouteReset(
        scope,
        "/teacher-dashboard/quizzes",
        "/teacher-dashboard/quizzes?entity=quizzes",
        "/teacher-dashboard/quizzes?entity=quizzes",
      ),
    ).toBeNull();

    expect(
      takeRouteReset(
        scope,
        "/teacher-dashboard/students",
        "/teacher-dashboard/students?entity=student_accounts&q=maria&page=3",
        "/teacher-dashboard/students?entity=student_accounts",
      ),
    ).toBe("/teacher-dashboard/students?entity=student_accounts");
  });

  it("leaves a re-entered section alone when its URL is already clean", () => {
    const scope = "clean-re-entry";

    takeRouteReset(scope, "/student-dashboard", "", "");
    expect(
      takeRouteReset(
        scope,
        "/student-dashboard",
        "/student-dashboard?tab=history",
        "/student-dashboard?tab=history",
      ),
    ).toBeNull();
  });
});
