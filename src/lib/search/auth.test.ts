import { describe, expect, it } from "vitest";
import {
  resolveSearchContext,
  type SearchAuthClient,
} from "./auth";
import {
  RoleLookupError,
  type AccountAccess,
} from "../auth/roles";

function access(overrides: Partial<AccountAccess>): AccountAccess {
  return {
    userId: "user-id",
    email: "user@example.test",
    username: "user_name",
    displayName: "user_name",
    role: "teacher",
    state: "active",
    teacherId: 42,
    teacherStatus: "approved",
    hasTeacherRecord: true,
    hasProfile: true,
    ...overrides,
  };
}

function createClient(input: {
  id?: string;
  access?: AccountAccess;
  currentLevel?: string | null;
  resolveError?: Error;
  user?: null;
}) {
  const client: SearchAuthClient = {
    auth: {
      getUser: async () => ({
        data: {
          user:
            input.user === null
              ? null
              : {
                  id: input.id ?? "user-id",
                  email: "user@example.test",
                  app_metadata: {},
                },
        },
        error: null,
      }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel: input.currentLevel ?? "aal1" },
          error: null,
        }),
      },
    },
    async resolveAccess() {
      if (input.resolveError) {
        throw input.resolveError;
      }

      return input.access ?? access({});
    },
  };

  return client;
}

describe("resolveSearchContext", () => {
  it("uses the live teachers row id for the teacher scope", async () => {
    const context = await resolveSearchContext(
      createClient({
        id: "auth-user-id",
        access: access({
          userId: "auth-user-id",
          teacherId: 42,
        }),
      }),
    );

    expect(context.role).toBe("teacher");
    expect(context.userId).toBe("auth-user-id");
    expect(context.teacherId).toBe("42");
    expect(context.teacherLabel).toBe("user_name");
  });

  it("checks admin membership and MFA assurance level", async () => {
    const context = await resolveSearchContext(
      createClient({
        access: access({
          role: "admin",
          teacherId: null,
          teacherStatus: null,
          hasTeacherRecord: false,
          displayName: "admin",
        }),
        currentLevel: "aal2",
      }),
    );

    expect(context.role).toBe("admin");
    expect(context.teacherId).toBeNull();
  });

  it("rejects an admin session without MFA", async () => {
    await expect(
      resolveSearchContext(
        createClient({
          access: access({
            role: "admin",
            teacherId: null,
            teacherStatus: null,
            hasTeacherRecord: false,
          }),
          currentLevel: "aal1",
        }),
      ),
    ).rejects.toMatchObject({
      status: 403,
      code: "MFA_REQUIRED",
    });
  });

  it("rejects a pending teacher account", async () => {
    await expect(
      resolveSearchContext(
        createClient({
          access: access({
            state: "pending",
            teacherStatus: "pending",
          }),
        }),
      ),
    ).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN_ROLE",
    });
  });

  it("does not report a role lookup failure as a forbidden role", async () => {
    await expect(
      resolveSearchContext(
        createClient({
          resolveError: new RoleLookupError("lookup failed"),
        }),
      ),
    ).rejects.toMatchObject({
      status: 503,
      code: "MEMBERSHIP_CHECK_FAILED",
    });
  });

  it("rejects a request without a signed-in user", async () => {
    await expect(
      resolveSearchContext(createClient({ user: null })),
    ).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
    });
  });
});
