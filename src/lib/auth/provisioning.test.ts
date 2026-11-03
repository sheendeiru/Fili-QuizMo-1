import { describe, expect, it } from "vitest";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { ensureAccountProfile } from "./provisioning";

type ProfileRow = {
  user_id: string;
  role: string;
  username: string | null;
  email: string | null;
  username_key: string | null;
  consent_accepted_at: string | null;
  consent_policy_version: string | null;
};

type TeacherRow = {
  id: number;
  user_id: string;
  status: string;
  username: string | null;
  email: string | null;
};

type QueryResult<T> = { data: T; error: { code?: string; message: string } | null };

class FakeDatabase {
  profiles = new Map<string, ProfileRow>();
  teachers = new Map<string, TeacherRow>();
  nextTeacherId = 1;

  private uniqueError(message: string) {
    return { code: "23505", message };
  }

  private profileByUsername(username: string) {
    const key = username.toLowerCase();

    return [...this.profiles.values()].find(
      (profile) => profile.username_key === key,
    );
  }

  private teacherByUsername(username: string) {
    return [...this.teachers.values()].find(
      (teacher) => teacher.username === username,
    );
  }

  from(table: "account_profiles" | "teachers" | "admins") {
    if (table === "admins") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async (): Promise<QueryResult<null>> => ({
              data: null,
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === "account_profiles") {
      return {
        select: () => ({
          eq: (_column: string, value: string) => ({
            maybeSingle: async (): Promise<QueryResult<ProfileRow | null>> => ({
              data: this.profiles.get(value) ?? null,
              error: null,
            }),
          }),
        }),
        insert: (row: {
          user_id: string;
          role: string;
          username?: string | null;
          email?: string | null;
          consent_accepted_at?: string | null;
          consent_policy_version?: string | null;
        }) => {
          if (this.profiles.has(row.user_id)) {
            return { error: this.uniqueError("duplicate profile") };
          }

          const username = row.username ?? null;

          if (username && this.profileByUsername(username)) {
            return { error: this.uniqueError("duplicate username") };
          }

          this.profiles.set(row.user_id, {
            user_id: row.user_id,
            role: row.role,
            username,
            email: row.email ?? null,
            username_key: username ? username.toLowerCase() : null,
            consent_accepted_at: row.consent_accepted_at ?? null,
            consent_policy_version: row.consent_policy_version ?? null,
          });

          return { error: null };
        },
        update: (values: { username?: string | null }) => ({
          eq: async (_column: string, value: string) => {
            const profile = this.profiles.get(value);

            if (!profile) {
              return { error: null };
            }

            const username = values.username ?? profile.username;
            const existing = username
              ? this.profileByUsername(username)
              : undefined;

            if (existing && existing.user_id !== profile.user_id) {
              return { error: this.uniqueError("duplicate username") };
            }

            profile.username = username;
            profile.username_key = username
              ? username.toLowerCase()
              : null;

            return { error: null };
          },
        }),
      };
    }

    return {
      select: () => ({
        eq: (_column: string, value: string) => ({
          maybeSingle: async (): Promise<QueryResult<TeacherRow | null>> => ({
            data: this.teachers.get(value) ?? null,
            error: null,
          }),
        }),
      }),
      insert: (row: {
        user_id: string;
        status: string;
        username?: string | null;
        email?: string | null;
      }) => {
        if (this.teachers.has(row.user_id)) {
          return { error: this.uniqueError("duplicate teacher user") };
        }

        if (row.username && this.teacherByUsername(row.username)) {
          return { error: this.uniqueError("duplicate teacher username") };
        }

        this.teachers.set(row.user_id, {
          id: this.nextTeacherId++,
          user_id: row.user_id,
          status: row.status,
          username: row.username ?? null,
          email: row.email ?? null,
        });

        return { error: null };
      },
    };
  }

  client() {
    return this as unknown as SupabaseClient<Database>;
  }
}

function user(metadata: Record<string, unknown>): User {
  return {
    id: "auth-user-id",
    email: "user@example.test",
    user_metadata: metadata,
    app_metadata: {},
    aud: "authenticated",
    created_at: "2026-11-02T00:00:00.000Z",
  } as User;
}

describe("ensureAccountProfile", () => {
  it("creates a student profile and routes to the student dashboard", async () => {
    const db = new FakeDatabase();
    const acceptedAt = "2026-11-03T00:00:00.000Z";
    const result = await ensureAccountProfile(
      db.client(),
      user({
        account_role: "student",
        username: "juan_dela_cruz",
        consent_accepted_at: acceptedAt,
        consent_policy_version: "v1",
      }),
    );

    expect(result).toMatchObject({
      ok: true,
      destination: "/student-dashboard",
    });
    expect(db.profiles.get("auth-user-id")).toMatchObject({
      role: "student",
      username: "juan_dela_cruz",
      consent_accepted_at: acceptedAt,
      consent_policy_version: "v1",
    });
    expect(db.teachers.size).toBe(0);
  });

  it("creates a pending teacher row alongside the teacher profile", async () => {
    const db = new FakeDatabase();
    const result = await ensureAccountProfile(
      db.client(),
      user({ account_role: "teacher", username: "msantos" }),
    );

    expect(result).toMatchObject({
      ok: true,
      destination: "/teacher-login?status=pending",
    });
    expect(db.profiles.get("auth-user-id")?.role).toBe("teacher");
    expect(db.teachers.get("auth-user-id")).toMatchObject({
      status: "pending",
      username: "msantos",
    });
  });

  it("is idempotent when called again after confirmation", async () => {
    const db = new FakeDatabase();
    const account = user({
      account_role: "student",
      username: "juan_dela_cruz",
    });

    const first = await ensureAccountProfile(db.client(), account);
    const second = await ensureAccountProfile(db.client(), account);

    expect(first).toMatchObject({ ok: true });
    expect(second).toMatchObject({ ok: true });
    expect(db.profiles.size).toBe(1);
  });

  it("does not let an existing student profile become a teacher", async () => {
    const db = new FakeDatabase();
    db.profiles.set("auth-user-id", {
      user_id: "auth-user-id",
      role: "student",
      username: "juan_dela_cruz",
      email: "user@example.test",
      username_key: "juan_dela_cruz",
      consent_accepted_at: null,
      consent_policy_version: null,
    });

    const result = await ensureAccountProfile(
      db.client(),
      user({ account_role: "teacher", username: "msantos" }),
      { role: "teacher", username: "msantos" },
    );

    expect(result).toMatchObject({
      ok: true,
      destination: "/student-dashboard",
    });
    expect(db.profiles.get("auth-user-id")?.role).toBe("student");
    expect(db.teachers.size).toBe(0);
  });

  it("recovers a teacher signup when the teachers username was taken", async () => {
    const db = new FakeDatabase();
    db.teachers.set("other-user", {
      id: 99,
      user_id: "other-user",
      status: "approved",
      username: "msantos",
      email: "other@example.test",
    });

    const failed = await ensureAccountProfile(
      db.client(),
      user({ account_role: "teacher", username: "msantos" }),
    );

    expect(failed).toMatchObject({
      ok: false,
      code: "username_taken",
    });
    expect(db.profiles.get("auth-user-id")?.role).toBe("teacher");
    expect(db.teachers.has("auth-user-id")).toBe(false);

    const recovered = await ensureAccountProfile(
      db.client(),
      user({ account_role: "teacher", username: "msantos" }),
      { role: "teacher", username: "msantos_2" },
    );

    expect(recovered).toMatchObject({
      ok: true,
      destination: "/teacher-login?status=pending",
    });
    expect(db.profiles.get("auth-user-id")?.username).toBe("msantos_2");
    expect(db.teachers.get("auth-user-id")?.username).toBe("msantos_2");
  });

  it("rejects a missing or invalid role for a new account", async () => {
    const db = new FakeDatabase();

    const missing = await ensureAccountProfile(db.client(), user({}));
    const invalid = await ensureAccountProfile(
      db.client(),
      user({ account_role: "admin", username: "admin_user" }),
    );

    expect(missing).toMatchObject({ ok: false, code: "invalid_role" });
    expect(invalid).toMatchObject({ ok: false, code: "invalid_role" });
    expect(db.profiles.size).toBe(0);
  });

  it("rejects an invalid username before writing", async () => {
    const db = new FakeDatabase();
    const result = await ensureAccountProfile(
      db.client(),
      user({ account_role: "student", username: "1bad" }),
    );

    expect(result).toMatchObject({
      ok: false,
      code: "invalid_username",
    });
    expect(db.profiles.size).toBe(0);
  });
});
