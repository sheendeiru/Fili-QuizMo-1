import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  resolveAccountAccess: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/auth/roles", () => ({
  createAccountRoleLookup: vi.fn(),
  resolveAccountAccess: mocks.resolveAccountAccess,
}));

import { isUuid, proxyTeacherRequest } from "./backend";

function signedIn(options: { user?: { id: string } | null; token?: string | null } = {}) {
  const user = options.user === undefined ? { id: "teacher-1" } : options.user;
  mocks.createClient.mockResolvedValue({
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
      getSession: async () => ({
        data: {
          session:
            options.token === null
              ? null
              : { access_token: options.token ?? "token-123" },
        },
      }),
    },
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("QUIZMO_API_URL", "https://quiz.example.com/");
  mocks.resolveAccountAccess.mockResolvedValue({ state: "active", role: "teacher" });
  signedIn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  fetchMock.mockReset();
});

describe("proxyTeacherRequest", () => {
  it("rejects a visitor who is not signed in", async () => {
    signedIn({ user: null });

    const response = await proxyTeacherRequest({ method: "GET", path: "/teacher/classes" });

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["student", "admin"])("rejects a %s account", async (role) => {
    mocks.resolveAccountAccess.mockResolvedValue({ state: "active", role });

    const response = await proxyTeacherRequest({ method: "GET", path: "/teacher/classes" });

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a teacher who is not approved yet", async () => {
    mocks.resolveAccountAccess.mockResolvedValue({ state: "pending", role: "teacher" });

    const response = await proxyTeacherRequest({ method: "GET", path: "/teacher/classes" });

    expect(response.status).toBe(403);
  });

  it("reports a missing backend URL without calling out", async () => {
    vi.stubEnv("QUIZMO_API_URL", "");

    const response = await proxyTeacherRequest({ method: "GET", path: "/teacher/classes" });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("BACKEND_NOT_CONFIGURED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards the teacher's own token and JSON body", async () => {
    fetchMock.mockResolvedValue(Response.json({ classId: "c1", name: "Rizal" }, { status: 201 }));

    const response = await proxyTeacherRequest({
      method: "POST",
      path: "/teacher/classes",
      body: { name: "Rizal" },
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ classId: "c1", name: "Rizal" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://quiz.example.com/teacher/classes");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer token-123");
    expect(init.body).toBe(JSON.stringify({ name: "Rizal" }));
  });

  it("passes the backend's error message through with its status", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: "You already have a class with this name." }, { status: 409 }),
    );

    const response = await proxyTeacherRequest({
      method: "POST",
      path: "/teacher/classes",
      body: { name: "Rizal" },
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toEqual({
      code: "CONFLICT",
      message: "You already have a class with this name.",
    });
  });

  it("hides backend internals when it fails without a message", async () => {
    fetchMock.mockResolvedValue(new Response("<html>boom</html>", { status: 502 }));

    const response = await proxyTeacherRequest({ method: "GET", path: "/teacher/classes" });
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error.message).not.toContain("boom");
  });

  it("answers 503 when the backend cannot be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const response = await proxyTeacherRequest({ method: "GET", path: "/teacher/classes" });

    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("BACKEND_UNAVAILABLE");
  });
});

describe("proxyTeacherRequest methods", () => {
  it("forwards a rename as PATCH with the new name", async () => {
    fetchMock.mockResolvedValue(Response.json({ classId: "c1", name: "Luna" }));

    const response = await proxyTeacherRequest({
      method: "PATCH",
      path: "/teacher/classes/c1",
      body: { name: "Luna" },
    });

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ name: "Luna" }));
  });
});

describe("isUuid", () => {
  it("accepts UUIDs and rejects path tricks", () => {
    expect(isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301")).toBe(true);
    expect(isUuid("../teacher/students")).toBe(false);
    expect(isUuid("")).toBe(false);
  });
});
