import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { AccountAccess } from "@/lib/auth/roles";

const { getClaimsMock, resolveAccessMock } = vi.hoisted(() => ({
  getClaimsMock: vi.fn(),
  resolveAccessMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getClaims: getClaimsMock,
    },
  }),
}));

vi.mock("@/lib/supabase/config", () => ({
  getSupabaseConfig: () => ({
    url: "https://example.supabase.co",
    publishableKey: "test-key",
  }),
}));

vi.mock("@/lib/auth/roles", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/roles")>();

  return {
    ...actual,
    createAccountRoleLookup: () => ({}),
    resolveAccountAccess: resolveAccessMock,
  };
});

import { proxy } from "./proxy";

function access(overrides: Partial<AccountAccess>): AccountAccess {
  return {
    userId: "auth-user-id",
    email: "user@example.test",
    username: "user_name",
    displayName: "user_name",
    role: "student",
    state: "active",
    teacherId: null,
    teacherStatus: null,
    hasTeacherRecord: false,
    hasProfile: true,
    ...overrides,
  };
}

function claims(input: { aal?: string } = {}) {
  return {
    data: {
      claims: {
        sub: "auth-user-id",
        email: "user@example.test",
        aal: input.aal ?? "aal1",
      },
    },
    error: null,
  };
}

async function request(path: string) {
  return proxy(new NextRequest(`http://localhost${path}`));
}

describe("proxy unauthenticated routes", () => {
  beforeEach(() => {
    getClaimsMock.mockResolvedValue({
      data: { claims: null },
      error: null,
    });
  });

  it.each(["/teacher-login", "/admin-login", "/student-login"])(
    "allows unauthenticated requests to %s",
    async (path) => {
      const response = await request(path);

      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("cache-control")).toBe(
        "private, no-store, max-age=0",
      );
    },
  );

  it.each([
    "/admin-dashboard",
    "/teacher-dashboard",
    "/student-dashboard",
  ])("redirects unauthenticated requests to %s to the homepage", async (path) => {
    const response = await request(path);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("redirects an unauthenticated profile setup request to signup", async () => {
    const response = await request("/complete-profile");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/signup?status=session_expired",
    );
  });
});

describe("proxy role and MFA enforcement", () => {
  beforeEach(() => {
    getClaimsMock.mockResolvedValue(claims());
    resolveAccessMock.mockReset();
  });

  it("allows an active student into the student dashboard", async () => {
    resolveAccessMock.mockResolvedValue(access({}));

    const response = await request("/student-dashboard");

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("sends a student away from the teacher dashboard", async () => {
    resolveAccessMock.mockResolvedValue(access({}));

    const response = await request("/teacher-dashboard");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/student-dashboard",
    );
  });

  it("sends a pending teacher to the teacher login", async () => {
    resolveAccessMock.mockResolvedValue(
      access({
        role: "teacher",
        state: "pending",
        teacherId: 42,
        teacherStatus: "pending",
        hasTeacherRecord: true,
      }),
    );

    const response = await request("/teacher-dashboard");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/teacher-login?status=pending",
    );
  });

  it("sends an unregistered user to profile setup", async () => {
    resolveAccessMock.mockResolvedValue(
      access({
        role: null,
        state: "unregistered",
        username: null,
        hasProfile: false,
      }),
    );

    const response = await request("/student-dashboard");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/complete-profile",
    );
  });

  it("requires AAL2 for the admin dashboard", async () => {
    resolveAccessMock.mockResolvedValue(
      access({
        role: "admin",
        username: "admin",
        displayName: "admin",
      }),
    );

    const response = await request("/admin-dashboard");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/admin-login?mfa=required",
    );
  });

  it("allows an AAL2 admin into the admin dashboard", async () => {
    getClaimsMock.mockResolvedValue(claims({ aal: "aal2" }));
    resolveAccessMock.mockResolvedValue(
      access({
        role: "admin",
        username: "admin",
        displayName: "admin",
      }),
    );

    const response = await request("/admin-dashboard");

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects to the login page when the role lookup fails", async () => {
    resolveAccessMock.mockRejectedValue(new Error("lookup failed"));

    const response = await request("/teacher-dashboard");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/teacher-login?status=unavailable",
    );
  });

  it("lets a signed-in user reach profile setup", async () => {
    resolveAccessMock.mockResolvedValue(
      access({
        role: null,
        state: "unregistered",
        username: null,
        hasProfile: false,
      }),
    );

    const response = await request("/complete-profile");

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
