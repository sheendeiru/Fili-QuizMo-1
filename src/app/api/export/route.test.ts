import { describe, expect, it, vi } from "vitest";
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

describe("export route authorization", () => {
  it("returns 401 for a request without an authenticated session", async () => {
    mocks.createClient.mockResolvedValue({});
    mocks.resolveSearchContext.mockRejectedValue(
      new SearchError(401, "UNAUTHENTICATED", "Sign in to export records."),
    );

    const response = await GET(
      new Request("http://localhost/api/export?entity=students"),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: { code: "UNAUTHENTICATED" },
    });
  });

  it("returns 403 when a student role is not allowed to export", async () => {
    mocks.createClient.mockResolvedValue({});
    mocks.resolveSearchContext.mockRejectedValue(
      new SearchError(403, "FORBIDDEN_ROLE", "This role cannot export records."),
    );

    const response = await GET(
      new Request("http://localhost/api/export?entity=students"),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: "FORBIDDEN_ROLE" },
    });
  });
});
