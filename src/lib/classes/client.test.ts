import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addStudents,
  createClass,
  listClasses,
  parseAssignedQuizzes,
  parseAssignments,
  parseClasses,
  parseUsernames,
} from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseUsernames", () => {
  it("splits on commas, spaces and lines and drops repeats", () => {
    expect(parseUsernames("maria_s, Juan_dc\nmaria_S;  ana_l")).toEqual([
      "maria_s",
      "Juan_dc",
      "ana_l",
    ]);
  });

  it("returns nothing for blank text", () => {
    expect(parseUsernames("  ,  ")).toEqual([]);
  });
});

describe("parseClasses", () => {
  it("keeps well-formed classes and ignores malformed rows", () => {
    expect(
      parseClasses({
        classes: [
          {
            classId: "c1",
            name: "Rizal",
            createdAt: "2026-11-09T00:00:00Z",
            students: [{ userId: "u1", username: "maria_s" }, { nope: true }],
          },
          { name: "no id" },
        ],
      }),
    ).toEqual([
      {
        classId: "c1",
        name: "Rizal",
        createdAt: "2026-11-09T00:00:00Z",
        students: [{ userId: "u1", username: "maria_s" }],
      },
    ]);
  });

  it("returns an empty list for an unexpected payload", () => {
    expect(parseClasses(null)).toEqual([]);
    expect(parseClasses({ classes: "x" })).toEqual([]);
  });
});

describe("class requests", () => {
  it("lists classes from /api/classes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ classes: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listClasses()).resolves.toEqual([]);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/classes");
  });

  it("throws the server's message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          { error: { code: "CONFLICT", message: "You already have a class with this name." } },
          { status: 409 },
        ),
      ),
    );

    await expect(createClass("Rizal")).rejects.toThrow(
      "You already have a class with this name.",
    );
  });

  it("explains a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));

    await expect(listClasses()).rejects.toThrow(/Could not reach the server/);
  });

  it("returns how many students were added", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ status: "success", added: 2 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(addStudents("c1", ["a_b", "c_d"])).resolves.toBe(2);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/classes/c1/students");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      usernames: ["a_b", "c_d"],
    });
  });
});

describe("assignment parsing", () => {
  it("reads where a quiz was sent and ignores malformed rows", () => {
    expect(
      parseAssignments({
        assignments: [
          {
            sessionId: "s1",
            classIds: ["c1", 5],
            students: [{ userId: "u1", username: "cara" }],
          },
          { classIds: ["c2"] },
        ],
      }),
    ).toEqual([
      { sessionId: "s1", classIds: ["c1"], students: [{ userId: "u1", username: "cara" }] },
    ]);
  });

  it("reads a student's quiz, including the snake_case deadline", () => {
    const [quiz] = parseAssignedQuizzes({
      quizzes: [
        {
          sessionId: "s1",
          title: "Science",
          totalQuestions: 10,
          maxAttempts: 2,
          attemptsUsed: 1,
          attemptsRemaining: 1,
          expires_at: "2026-12-01T00:00:00Z",
          completed: true,
        },
      ],
    });

    expect(quiz).toMatchObject({
      sessionId: "s1",
      title: "Science",
      maxAttempts: 2,
      attemptsRemaining: 1,
      expiresAt: "2026-12-01T00:00:00Z",
      completed: true,
      isExpired: false,
    });
    expect(parseAssignedQuizzes(null)).toEqual([]);
  });
});
