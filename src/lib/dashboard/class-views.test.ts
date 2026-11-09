import { describe, expect, it } from "vitest";
import { buildAssignedTo, buildClassViews } from "./data";

type Row = Parameters<typeof buildClassViews>[1][number];

function result(username: string, title: string, percentage: number, n: number): Row {
  return {
    attempt_id: `attempt-${n}`,
    session_id: "session-1",
    title,
    participant_username: username,
    percentage,
    correct_count: null,
    total_questions: null,
    completed_at: `2026-11-0${n}T00:00:00Z`,
  };
}

const classes = [
  {
    classId: "c1",
    name: "Rizal",
    createdAt: null,
    students: [
      { userId: "u1", username: "Maria_S" },
      { userId: "u2", username: "juan" },
    ],
  },
  { classId: "c2", name: "Bonifacio", createdAt: null, students: [] },
];

const results = [
  result("maria_s", "Science", 90, 1),
  result("JUAN", "Science", 70, 2),
  result("ana", "Science", 10, 3),
];

describe("buildClassViews", () => {
  it("keeps only the class's students, ignoring case", () => {
    const [rizal] = buildClassViews(classes, results);

    expect(rizal.studentCount).toBe(2);
    expect(rizal.results).toEqual({ total: 2, average: 80 });
    expect(
      rizal.leaderboards.overall.entries.map((entry) => entry.student).sort(),
    ).toEqual(["JUAN", "maria_s"]);
  });

  it("gives an empty class empty results", () => {
    const [, empty] = buildClassViews(classes, results);

    expect(empty.studentCount).toBe(0);
    expect(empty.results).toEqual({ total: 0, average: 0 });
    expect(empty.leaderboards.overall.entries).toEqual([]);
  });

  it("returns nothing when there are no classes", () => {
    expect(buildClassViews([], results)).toEqual([]);
  });
});

describe("class quiz progress", () => {
  const assignments = [
    { sessionId: "session-1", classIds: ["c1"], students: [] },
    { sessionId: "session-gone", classIds: ["c1"], students: [] },
    { sessionId: "session-1", classIds: ["c2"], students: [] },
  ];
  const titles = new Map([["session-1", "Science"]]);

  it("counts who finished, averages best scores, and lists who has not", () => {
    const rows = [
      result("maria_s", "Science", 60, 1),
      result("Maria_S", "Science", 100, 2),
      result("ana", "Science", 10, 3),
    ];
    const [rizal] = buildClassViews(classes, rows, assignments, titles);

    expect(rizal.quizProgress).toEqual([
      {
        sessionId: "session-1",
        title: "Science",
        assignedCount: 2,
        takenCount: 1,
        average: 100,
        notTaken: ["juan"],
      },
    ]);
  });

  it("skips quizzes that are no longer listed", () => {
    const [rizal] = buildClassViews(classes, results, assignments, titles);

    expect(rizal.quizProgress.map((q) => q.sessionId)).toEqual(["session-1"]);
  });

  it("shows a quiz nobody took with no average and everyone missing", () => {
    const [, bonifacio] = buildClassViews(classes, [], assignments, titles);

    expect(bonifacio.quizProgress[0]).toMatchObject({
      assignedCount: 0,
      takenCount: 0,
      average: null,
      notTaken: [],
    });
  });
});

describe("buildAssignedTo", () => {
  it("names classes and students, and drops deleted classes", () => {
    expect(
      buildAssignedTo(classes, [
        {
          sessionId: "q1",
          classIds: ["c1", "deleted"],
          students: [{ userId: "u9", username: "cara" }],
        },
        { sessionId: "q2", classIds: ["deleted"], students: [] },
      ]),
    ).toEqual({ q1: { classes: ["Rizal"], students: ["cara"] } });
  });
});
