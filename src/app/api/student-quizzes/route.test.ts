import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchError } from "@/lib/search/errors";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  resolveSearchContext: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/search/auth", () => ({
  resolveSearchContext: mocks.resolveSearchContext,
}));

import { GET } from "./route";

const STUDENT_ID = "3F2504E0-4F89-41D3-9A0C-0305E82C3301";
const url = (id: string) =>
  `http://localhost/api/student-quizzes?studentId=${id}`;

type Result = { data: unknown; error: { message: string } | null };

/** A tiny stand-in for the Supabase query builder that records the calls made. */
function fakeSupabase(options: {
  profile?: Result;
  scores?: Result;
}) {
  const calls: Array<[string, ...unknown[]]> = [];

  function builder(table: string, result: Result) {
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "order", "limit"]) {
      chain[method] = (...args: unknown[]) => {
        calls.push([`${table}.${method}`, ...args]);
        return chain;
      };
    }
    chain.maybeSingle = () => Promise.resolve(result);
    chain.then = (resolve: (value: Result) => unknown) =>
      Promise.resolve(result).then(resolve);
    return chain;
  }

  return {
    calls,
    client: {
      from: (table: string) =>
        table === "account_profiles"
          ? builder(
              table,
              options.profile ?? {
                data: { user_id: STUDENT_ID.toLowerCase(), username: "Maria" },
                error: null,
              },
            )
          : builder(table, options.scores ?? { data: [], error: null }),
    },
  };
}

function row(index: number) {
  return {
    attempt_id: `attempt-${index}`,
    session_id: "session-1",
    quiz_title: ` Quiz ${index} `,
    attempt_number: 1,
    correct_count: 4,
    total_questions: 5,
    percentage: 80,
    started_at: "2026-11-01T01:00:00Z",
    completed_at: "2026-11-01T01:05:00Z",
    duration_seconds: 300,
  };
}

describe("student quizzes route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.resolveSearchContext.mockResolvedValue({ role: "teacher" });
  });

  it.each(["", "not-a-uuid", "1; drop table quizzes"])(
    "rejects an invalid student id %j before touching the database",
    async (id) => {
      const response = await GET(new Request(url(encodeURIComponent(id))));

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        error: { code: "INVALID_STUDENT" },
      });
      expect(mocks.createClient).not.toHaveBeenCalled();
    },
  );

  it("passes through authentication and role errors", async () => {
    mocks.createClient.mockResolvedValue(fakeSupabase({}).client);
    mocks.resolveSearchContext.mockRejectedValue(
      new SearchError(401, "UNAUTHENTICATED", "Sign in to search records."),
    );

    const response = await GET(new Request(url(STUDENT_ID)));

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("returns 404 when the student is not visible to this teacher", async () => {
    const { client, calls } = fakeSupabase({
      profile: { data: null, error: null },
    });
    mocks.createClient.mockResolvedValue(client);

    const response = await GET(new Request(url(STUDENT_ID)));

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: { code: "STUDENT_NOT_FOUND" },
    });
    expect(calls.some(([name]) => name.startsWith("teacher_student_scores"))).toBe(
      false,
    );
  });

  it("returns the student's finished quizzes, newest first", async () => {
    const { client, calls } = fakeSupabase({
      scores: { data: [row(1), { ...row(2), quiz_title: null }], error: null },
    });
    mocks.createClient.mockResolvedValue(client);

    const response = await GET(new Request(url(STUDENT_ID)));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      student: { id: STUDENT_ID.toLowerCase(), username: "Maria" },
      scope: "own-quizzes",
      truncated: false,
    });
    expect(body.quizzes).toHaveLength(2);
    expect(body.quizzes[0]).toEqual({
      attemptId: "attempt-1",
      sessionId: "session-1",
      quizTitle: "Quiz 1",
      attemptNumber: 1,
      correctCount: 4,
      totalQuestions: 5,
      percentage: 80,
      startedAt: "2026-11-01T01:00:00Z",
      completedAt: "2026-11-01T01:05:00Z",
      durationSeconds: 300,
    });
    expect(body.quizzes[1].quizTitle).toBe("Untitled quiz");
    expect(JSON.stringify(body)).not.toMatch(/correct_?answer|email/i);
    expect(calls).toContainEqual([
      "teacher_student_scores.eq",
      "student_user_id",
      STUDENT_ID.toLowerCase(),
    ]);
    expect(calls).toContainEqual([
      "account_profiles.eq",
      "role",
      "student",
    ]);
    expect(calls).toContainEqual([
      "teacher_student_scores.order",
      "completed_at",
      { ascending: false, nullsFirst: false },
    ]);
  });

  it("reports the wider scope for an admin", async () => {
    mocks.resolveSearchContext.mockResolvedValue({ role: "admin" });
    mocks.createClient.mockResolvedValue(fakeSupabase({}).client);

    const body = await (await GET(new Request(url(STUDENT_ID)))).json();

    expect(body.scope).toBe("all-quizzes");
    expect(body.quizzes).toEqual([]);
  });

  it("caps the list at 100 attempts and says so", async () => {
    const rows = Array.from({ length: 101 }, (_, index) => row(index));
    mocks.createClient.mockResolvedValue(
      fakeSupabase({ scores: { data: rows, error: null } }).client,
    );

    const body = await (await GET(new Request(url(STUDENT_ID)))).json();

    expect(body.quizzes).toHaveLength(100);
    expect(body.truncated).toBe(true);
  });

  it("tolerates missing numbers in a row", async () => {
    mocks.createClient.mockResolvedValue(
      fakeSupabase({
        scores: {
          data: [
            {
              ...row(1),
              percentage: null,
              duration_seconds: null,
              correct_count: null,
            },
          ],
          error: null,
        },
      }).client,
    );

    const body = await (await GET(new Request(url(STUDENT_ID)))).json();

    expect(body.quizzes[0]).toMatchObject({
      percentage: null,
      durationSeconds: null,
      correctCount: null,
    });
  });

  it("hides database error details", async () => {
    mocks.createClient.mockResolvedValue(
      fakeSupabase({
        scores: { data: null, error: { message: "secret relation detail" } },
      }).client,
    );

    const response = await GET(new Request(url(STUDENT_ID)));

    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret");
  });

  it("hides profile lookup failures too", async () => {
    mocks.createClient.mockResolvedValue(
      fakeSupabase({
        profile: { data: null, error: { message: "secret profile detail" } },
      }).client,
    );

    const response = await GET(new Request(url(STUDENT_ID)));

    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret");
  });

  it("turns unexpected failures into a safe 500", async () => {
    mocks.createClient.mockRejectedValue(new Error("secret connection string"));

    const response = await GET(new Request(url(STUDENT_ID)));

    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("secret");
  });
});
