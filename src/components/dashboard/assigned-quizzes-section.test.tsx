import { describe, expect, it } from "vitest";
import { quizStatus } from "./assigned-quizzes-section";
import type { AssignedQuiz } from "@/lib/classes/client";

function quiz(patch: Partial<AssignedQuiz>): AssignedQuiz {
  return {
    sessionId: "s1",
    title: "Science",
    gameMode: "multiple_choice",
    teacherUsername: "t",
    totalQuestions: 10,
    isTimeAttack: false,
    timeAttackSeconds: 60,
    maxAttempts: 2,
    attemptsUsed: 0,
    attemptsRemaining: 2,
    completed: false,
    expiresAt: null,
    isExpired: false,
    assignedAt: null,
    ...patch,
  };
}

describe("quizStatus", () => {
  it("is to do until the student finishes it", () => {
    expect(quizStatus(quiz({})).label).toBe("To do");
    expect(quizStatus(quiz({ completed: true })).label).toBe("Finished");
  });

  it("flags closed quizzes first, then used-up attempts", () => {
    expect(
      quizStatus(quiz({ isExpired: true, completed: true, attemptsRemaining: 0 })).label,
    ).toBe("Closed");
    expect(
      quizStatus(quiz({ completed: true, attemptsRemaining: 0 })).label,
    ).toBe("No attempts left");
  });
});
