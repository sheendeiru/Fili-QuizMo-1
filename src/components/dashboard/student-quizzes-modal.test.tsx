import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  formatDuration,
  parseStudentQuizzes,
  scoreVariant,
  StudentQuizzesList,
  type StudentQuizAttempt,
  type StudentQuizzesPayload,
} from "./student-quizzes-modal";
import { rowActionsFor } from "./manage-accounts";

function attempt(overrides: Partial<StudentQuizAttempt> = {}): StudentQuizAttempt {
  return {
    attemptId: "a1",
    sessionId: "s1",
    quizTitle: "Alamat ng Pinya",
    attemptNumber: 2,
    correctCount: 4,
    totalQuestions: 5,
    percentage: 80,
    startedAt: "2026-11-01T01:00:00Z",
    completedAt: "2026-11-01T01:05:00Z",
    durationSeconds: 125,
    ...overrides,
  };
}

function payload(
  overrides: Partial<StudentQuizzesPayload> = {},
): StudentQuizzesPayload {
  return {
    student: { id: "u1", username: "Maria" },
    scope: "own-quizzes",
    truncated: false,
    quizzes: [attempt()],
    ...overrides,
  };
}

const render = (value: StudentQuizzesPayload) =>
  renderToStaticMarkup(createElement(StudentQuizzesList, { payload: value }));

describe("row actions", () => {
  it("gives student rows View and a bulk Delete beside Create, not a row Delete", () => {
    expect(rowActionsFor("student")).toEqual({
      canView: true,
      canDelete: false,
      canBulkDelete: true,
    });
  });

  it("keeps the per-row Delete, with no View or bulk Delete, on teacher rows", () => {
    expect(rowActionsFor("teacher")).toEqual({
      canView: false,
      canDelete: true,
      canBulkDelete: false,
    });
  });
});

describe("student quizzes list", () => {
  it("shows each finished attempt with score, date and time taken", () => {
    const markup = render(payload());

    expect(markup).toContain("Alamat ng Pinya");
    expect(markup).toContain("4/5");
    expect(markup).toContain("80%");
    expect(markup).toContain("Nov 1, 2026");
    expect(markup).toContain("2m 05s");
    expect(markup).toContain("Quizzes taken by Maria");
    expect(markup).toContain("on your quizzes");
  });

  it("explains an empty history for a teacher and for an admin", () => {
    expect(render(payload({ quizzes: [] }))).toContain(
      "has not finished any of your quizzes yet",
    );
    expect(render(payload({ quizzes: [], scope: "all-quizzes" }))).toContain(
      "has not finished any quizzes yet",
    );
  });

  it("falls back to dashes for missing numbers", () => {
    const markup = render(
      payload({
        quizzes: [
          attempt({
            correctCount: null,
            percentage: null,
            durationSeconds: null,
            completedAt: null,
            attemptNumber: null,
          }),
        ],
      }),
    );

    expect(markup).not.toContain("%");
    expect(markup).toContain("—");
  });

  it("notes when only the most recent attempts are shown", () => {
    expect(render(payload({ truncated: true }))).toContain(
      "Showing the 1 most recent attempts.",
    );
  });

  it("escapes quiz titles", () => {
    const markup = render(
      payload({ quizzes: [attempt({ quizTitle: "<img src=x onerror=alert(1)>" })] }),
    );

    expect(markup).not.toContain("<img");
    expect(markup).toContain("&lt;img");
  });
});

describe("helpers", () => {
  it.each([
    [null, "—"],
    [-1, "—"],
    [0, "0s"],
    [45, "45s"],
    [60, "1m 00s"],
    [125, "2m 05s"],
  ])("formats %j seconds as %s", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it.each([
    [null, "info"],
    [100, "success"],
    [75, "success"],
    [74, "warning"],
    [50, "warning"],
    [49, "danger"],
    [0, "danger"],
  ] as const)("colors %j percent as %s", (percentage, expected) => {
    expect(scoreVariant(percentage)).toBe(expected);
  });

  it("accepts a well-formed response and rejects a malformed one", () => {
    expect(parseStudentQuizzes(payload())).toMatchObject({
      student: { username: "Maria" },
      quizzes: [{ attemptId: "a1" }],
    });
    expect(parseStudentQuizzes({ ...payload(), scope: "other" })?.scope).toBe(
      "own-quizzes",
    );
    expect(parseStudentQuizzes(null)).toBeNull();
    expect(parseStudentQuizzes({ student: {}, quizzes: [] })).toBeNull();
    expect(
      parseStudentQuizzes({ ...payload(), quizzes: [{ attemptId: 1 }] }),
    ).toBeNull();
  });
});
