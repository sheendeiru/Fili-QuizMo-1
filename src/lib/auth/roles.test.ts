import { describe, expect, it } from "vitest";
import {
  RoleLookupError,
  createAccountRoleLookup,
  destinationForAccess,
  isValidUsername,
  resolveAccountAccess,
  roleFromMetadata,
  usernameFromMetadata,
  type AccountRoleLookup,
  type ProfileRecord,
  type TeacherRecord,
} from "./roles";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

function lookup(input: {
  admin?: boolean;
  teacher?: TeacherRecord | null;
  profile?: ProfileRecord | null;
  error?: "admins" | "teachers" | "account_profiles";
}): AccountRoleLookup {
  const failure = input.error
    ? { code: "42501", message: "permission denied" }
    : null;

  return {
    async getAdmin() {
      return {
        found: Boolean(input.admin),
        error: input.error === "admins" ? failure : null,
      };
    },
    async getTeacher() {
      return {
        teacher: input.teacher ?? null,
        error: input.error === "teachers" ? failure : null,
      };
    },
    async getProfile() {
      return {
        profile: input.profile ?? null,
        error: input.error === "account_profiles" ? failure : null,
      };
    },
  };
}

const user = { id: "auth-user-id", email: "user@example.test" };

describe("resolveAccountAccess", () => {
  it("gives admin membership precedence over teacher and profile rows", async () => {
    const access = await resolveAccountAccess(
      lookup({
        admin: true,
        teacher: {
          id: 7,
          status: "approved",
          username: "teacher_name",
          email: "teacher@example.test",
        },
        profile: {
          role: "student",
          username: "student_name",
          email: "student@example.test",
        },
      }),
      user,
    );

    expect(access.role).toBe("admin");
    expect(access.state).toBe("active");
    expect(access.teacherId).toBe(7);
    expect(access.hasProfile).toBe(true);
  });

  it("marks an approved teacher as active with the live bigint id", async () => {
    const access = await resolveAccountAccess(
      lookup({
        teacher: {
          id: 42,
          status: "approved",
          username: "msantos",
          email: "msantos@example.test",
        },
      }),
      user,
    );

    expect(access).toMatchObject({
      role: "teacher",
      state: "active",
      teacherId: 42,
      teacherStatus: "approved",
      username: "msantos",
    });
  });

  it("marks a pending teacher as pending", async () => {
    const access = await resolveAccountAccess(
      lookup({
        teacher: {
          id: 42,
          status: "pending",
          username: "msantos",
          email: null,
        },
      }),
      user,
    );

    expect(access.state).toBe("pending");
    expect(access.role).toBe("teacher");
  });

  it("marks suspended and rejected teachers as blocked", async () => {
    for (const status of ["suspended", "rejected"]) {
      const access = await resolveAccountAccess(
        lookup({
          teacher: {
            id: 42,
            status,
            username: "msantos",
            email: null,
          },
        }),
        user,
      );

      expect(access.state).toBe("blocked");
      expect(access.teacherStatus).toBe(status);
    }
  });

  it("marks a student profile as active", async () => {
    const access = await resolveAccountAccess(
      lookup({
        profile: {
          role: "student",
          username: "juan_dela_cruz",
          email: "juan@example.test",
        },
      }),
      user,
    );

    expect(access).toMatchObject({
      role: "student",
      state: "active",
      teacherId: null,
      hasProfile: true,
    });
  });

  it("treats a teacher profile without a teachers row as incomplete", async () => {
    const access = await resolveAccountAccess(
      lookup({
        profile: {
          role: "teacher",
          username: "msantos",
          email: "msantos@example.test",
        },
      }),
      user,
    );

    expect(access).toMatchObject({
      role: "teacher",
      state: "blocked",
      hasTeacherRecord: false,
      hasProfile: true,
    });
  });

  it("returns unregistered when no role row exists", async () => {
    const access = await resolveAccountAccess(lookup({}), user);

    expect(access).toMatchObject({
      role: null,
      state: "unregistered",
      displayName: "user",
      hasProfile: false,
    });
  });

  it("throws a role lookup error instead of silently denying access", async () => {
    await expect(
      resolveAccountAccess(lookup({ error: "teachers" }), user),
    ).rejects.toBeInstanceOf(RoleLookupError);
  });
});

describe("destinationForAccess", () => {
  it("routes active roles to their dashboards", async () => {
    const access = await resolveAccountAccess(lookup({ admin: true }), user);

    expect(destinationForAccess(access)).toBe("/admin-dashboard");
  });

  it("routes pending teachers back to the teacher login", async () => {
    const access = await resolveAccountAccess(
      lookup({
        teacher: {
          id: 42,
          status: "pending",
          username: "msantos",
          email: null,
        },
      }),
      user,
    );

    expect(destinationForAccess(access)).toBe(
      "/teacher-login?status=pending",
    );
  });
});

describe("metadata helpers", () => {
  it("accepts only student and teacher metadata roles", () => {
    expect(roleFromMetadata({ account_role: "student" })).toBe("student");
    expect(roleFromMetadata({ account_role: " Teacher " })).toBe("teacher");
    expect(roleFromMetadata({ account_role: "admin" })).toBeNull();
    expect(roleFromMetadata({ account_role: 7 })).toBeNull();
  });

  it("trims the username from metadata", () => {
    expect(usernameFromMetadata({ username: "  juan  " })).toBe("juan");
    expect(usernameFromMetadata({ username: 7 })).toBeNull();
  });

  it("matches the live student username constraint", () => {
    expect(isValidUsername("juan_dela_cruz")).toBe(true);
    expect(isValidUsername("a1")).toBe(false);
    expect(isValidUsername("1juan")).toBe(false);
    expect(isValidUsername("juan-dela-cruz")).toBe(false);
    expect(isValidUsername("a".repeat(16))).toBe(false);
  });
});

describe("createAccountRoleLookup", () => {
  it("maps Supabase lookup failures without leaking table errors", async () => {
    const supabase = {
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({
            data: null,
            error: { code: "42501", message: "permission denied" },
          }),
        };
      },
    } as unknown as SupabaseClient<Database>;

    const result = await createAccountRoleLookup(supabase).getProfile(
      "auth-user-id",
    );

    expect(result.profile).toBeNull();
    expect(result.error).toEqual({
      code: "42501",
      message: "permission denied",
    });
  });
});
