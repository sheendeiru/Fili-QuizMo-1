import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), resolveAccountAccess: vi.fn(), fetch: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/auth/roles", () => ({
  createAccountRoleLookup: vi.fn(), resolveAccountAccess: mocks.resolveAccountAccess,
}));
import { GET } from "./route";
import { GET as getQuizzes } from "../assigned-quizzes/route";

const payload = { awards: [{ badge: 1, unlockedAt: "2026-11-09T08:00:00Z" }],
  distinctQuizzes: 1, bestImprovement: 0, streak: 1, bestPercentage: 90 };

function signIn(user: { id: string } | null = { id: "student-a" }) {
  mocks.createClient.mockResolvedValue({ auth: {
    getUser: async () => ({ data: { user }, error: null }),
    getSession: async () => ({ data: { session: { access_token: "student-token" } } }),
  } });
}
beforeEach(() => {
  signIn();
  mocks.resolveAccountAccess.mockResolvedValue({ state: "active", role: "student" });
  vi.stubEnv("QUIZMO_API_URL", "https://quiz.example.com");
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetAllMocks(); });

it("requires a signed-in student", async () => {
  signIn(null);
  expect((await GET()).status).toBe(401);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it.each(["teacher", "admin"])("rejects %s access before contacting the backend", async (role) => {
  mocks.resolveAccountAccess.mockResolvedValue({ state: "active", role });
  expect((await GET()).status).toBe(403);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("forwards only the current session token to the mobile endpoint and disables caching", async () => {
  mocks.fetch.mockResolvedValue(Response.json(payload));
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(payload);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(mocks.fetch).toHaveBeenCalledWith("https://quiz.example.com/student-achievements",
    expect.objectContaining({ cache: "no-store", headers: {
      Authorization: "Bearer student-token", Accept: "application/json",
    } }));
});
it("reports a failed sync without fabricating achievements or exposing upstream errors", async () => {
  mocks.fetch.mockResolvedValue(Response.json({ error: "internal details" }, { status: 500 }));
  const response = await GET();
  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain("internal details");
});
it("rejects malformed backend data", async () => {
  mocks.fetch.mockResolvedValue(Response.json({}));
  expect((await GET()).status).toBe(503);
});

it("reports missing configuration without contacting the backend", async () => {
  vi.stubEnv("QUIZMO_API_URL", "");
  const response = await GET();
  expect(response.status).toBe(503);
  expect((await response.json()).error.code).toBe("BACKEND_NOT_CONFIGURED");
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it("loads assigned quizzes through the student's token", async () => {
  const data = { quizzes: [{ sessionId: "assigned-1", title: "Filipino" }] };
  mocks.fetch.mockResolvedValue(Response.json(data));
  const response = await getQuizzes();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(data);
  expect(mocks.fetch).toHaveBeenCalledWith("https://quiz.example.com/student/quizzes",
    expect.objectContaining({ headers: { Authorization: "Bearer student-token", Accept: "application/json" } }));
});

it("does not turn a broken assigned-quizzes response into an empty list", async () => {
  mocks.fetch.mockResolvedValue(Response.json({ error: "missing data" }));
  expect((await getQuizzes()).status).toBe(503);
});

it("protects assigned quizzes from unsigned callers", async () => {
  signIn(null);
  expect((await getQuizzes()).status).toBe(401);
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it("can recover after an upstream failure on the next request", async () => {
  mocks.fetch.mockRejectedValueOnce(new Error("timeout"));
  expect((await getQuizzes()).status).toBe(503);
  mocks.fetch.mockResolvedValueOnce(Response.json({ quizzes: [] }));
  expect((await getQuizzes()).status).toBe(200);
});
