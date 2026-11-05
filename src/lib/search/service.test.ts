import { describe, expect, it } from "vitest";
import { MockSearchRepository } from "./mock-repository";
import { createSearchScope } from "./scope";
import { executeSearch } from "./service";
import { defaultSearchQuery } from "./url-state";
import { parseSearchQuery } from "./validation";
import type { SearchRow } from "./types";

const rows: Record<
  "students" | "student_accounts" | "quizzes" | "teachers",
  SearchRow[]
> = {
  students: [
    {
      participant_id: "participant-a",
      teacher_id: "teacher-a",
      username: "own_student",
      status: "completed",
      score: "92.50",
      quiz_id: "quiz-a",
      quiz_title: "Science",
      session_id: "session-a",
      session_code: "AAAAAA",
      student_email: "own@example.test",
      teacher_username: "msantos",
      joined_at: "2026-01-01T00:00:00.000Z",
    },
    {
      participant_id: "participant-b",
      teacher_id: "teacher-b",
      username: "other_student",
      status: "completed",
      score: null,
      quiz_id: "quiz-b",
      quiz_title: "Math",
      session_id: "session-b",
      session_code: "BBBBBB",
      student_email: "other@example.test",
      teacher_username: "jdelacruz",
      joined_at: "2026-01-02T00:00:00.000Z",
    },
  ],
  student_accounts: [
    {
      student_id: "student-a",
      teacher_id: "teacher-a",
      teacher_username: "msantos",
      username: "own_student",
      email: "own@example.test",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      student_id: "student-b",
      teacher_id: "teacher-b",
      teacher_username: "jdelacruz",
      username: "other_student",
      email: "other@example.test",
      created_at: "2026-01-02T00:00:00.000Z",
    },
  ],
  quizzes: [],
  teachers: [],
};

describe("search service role scoping", () => {
  it("only returns student accounts owned by the authenticated teacher", async () => {
    const context = createSearchScope({
      role: "teacher",
      userId: "teacher-a",
    });
    const response = await executeSearch({
      context,
      query: defaultSearchQuery("teacher", "student_accounts"),
      repository: new MockSearchRepository(rows),
    });

    expect(response.items.map((item) => item.id)).toEqual(["student-a"]);
    expect(response.meta.scope).toBe("own-records");
  });

  it("does not widen student results when a teacher edits the scope parameter", async () => {
    const context = createSearchScope({
      role: "teacher",
      userId: "teacher-a",
    });
    const query = parseSearchQuery(
      new URLSearchParams(
        "entity=students&teacher_id=teacher-b",
      ),
      "teacher",
    );
    const response = await executeSearch({
      context,
      query,
      repository: new MockSearchRepository(rows),
    });

    expect(response.items.map((item) => item.id)).toEqual(["participant-a"]);
  });

  it("allows an admin to search across teachers", async () => {
    const response = await executeSearch({
      context: createSearchScope({ role: "admin", userId: "admin-id" }),
      query: defaultSearchQuery("admin", "student_accounts"),
      repository: new MockSearchRepository(rows),
    });

    expect(response.items.map((item) => item.id).sort()).toEqual([
      "student-a",
      "student-b",
    ]);
    expect(response.meta.scope).toBe("all-records");
  });

  it("coerces PostgREST numeric strings in student scores", async () => {
    const response = await executeSearch({
      context: createSearchScope({ role: "admin", userId: "admin-id" }),
      query: defaultSearchQuery("admin", "students"),
      repository: new MockSearchRepository(rows),
    });

    expect(response.items).toContainEqual(
      expect.objectContaining({ id: "participant-a", score: 92.5 }),
    );
    expect(response.items).toContainEqual(
      expect.objectContaining({ id: "participant-b", score: null }),
    );
  });
});
