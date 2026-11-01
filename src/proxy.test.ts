import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getClaimsMock } = vi.hoisted(() => ({
  getClaimsMock: vi.fn(),
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

import { proxy } from "./proxy";

describe("proxy unauthenticated routes", () => {
  beforeEach(() => {
    getClaimsMock.mockResolvedValue({
      data: { claims: null },
      error: null,
    });
  });

  it.each(["/teacher-login", "/admin-login"])(
    "allows unauthenticated requests to %s",
    async (path) => {
      const response = await proxy(
        new NextRequest(`http://localhost${path}`),
      );

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
    const response = await proxy(
      new NextRequest(`http://localhost${path}`),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/");
  });
});
