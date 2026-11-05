import { describe, expect, it } from "vitest";
import { MockSearchRepository } from "./mock-repository";
import { createSearchScope } from "./scope";
import { executeSearch } from "./service";
import { defaultSearchQuery } from "./url-state";
import { parseSearchQuery } from "./validation";
import type { SearchRow } from "./types";

const rows: Record<"students" | "quizzes" | "participants" | "teachers", SearchRow[]> = {
  students: [
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
  participants: [
    {
      participant_id: "participant-a",
      teacher_id: "teacher-a",
      username: "own_student",
      status: "completed",
      score: "92.50",
      joined_at: "2026-01-01T00:00:00.000Z",
    },
    {
      participant_id: "participant-b",
      teacher_id: "teacher-b",
      username: "other_student",
      status: "completed",
      score: null,
      joined_at: "2026-01-02T00:00:00.000Z",
    },
  ],
  teachers: [],
};

describe("search service role scoping", () => {
  it("only returns students owned by the authenticated teacher", async () => {
    const context = createSearchScope({
      role: "teacher",
      userId: "teacher-a",
    });
    const response = await executeSearch({
      context,
      query: defaultSearchQuery("teacher", "students"),
      repository: new MockSearchRepository(rows),
    });

    expect(response.items.map((item) => item.id)).toEqual(["student-a"]);
    expect(response.meta.scope).toBe("own-records");
  });

  it("does not widen participant results when a teacher edits the scope parameter", async () => {
    const context = createSearchScope({
      role: "teacher",
      userId: "teacher-a",
    });
    const query = parseSearchQuery(
      new URLSearchParams(
        "entity=participants&teacher_id=teacher-b",
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
      query: defaultSearchQuery("admin", "students"),
      repository: new MockSearchRepository(rows),
    });

    expect(response.items.map((item) => item.id).sort()).toEqual([
      "student-a",
      "student-b",
    ]);
    expect(response.meta.scope).toBe("all-records");
  });

  it("coerces PostgREST numeric strings in participant scores", async () => {
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
