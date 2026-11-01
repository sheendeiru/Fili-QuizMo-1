import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export const ACCOUNT_ROLES = ["admin", "teacher", "student"] as const;

export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export const USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{2,14}$/;
export const USERNAME_REQUIREMENTS =
  "Username must be 3 to 15 characters, start with a letter, and use only letters, numbers, or underscores.";

export type AccountAccessState =
  | "active"
  | "pending"
  | "blocked"
  | "unregistered";

export type TeacherStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "suspended";

export type AccountAccess = {
  userId: string;
  email: string | null;
  username: string | null;
  displayName: string;
  role: AccountRole | null;
  state: AccountAccessState;
  teacherId: number | null;
  teacherStatus: TeacherStatus | null;
  hasTeacherRecord: boolean;
  hasProfile: boolean;
};

export type RoleLookupErrorInfo = {
  code?: string;
  message: string;
};

export type TeacherRecord = {
  id: number;
  status: string;
  username: string | null;
  email: string | null;
};

export type ProfileRecord = {
  role: string;
  username: string | null;
  email: string | null;
};

export type AccountRoleLookup = {
  getAdmin(
    userId: string,
  ): Promise<{ found: boolean; error: RoleLookupErrorInfo | null }>;
  getTeacher(userId: string): Promise<{
    teacher: TeacherRecord | null;
    error: RoleLookupErrorInfo | null;
  }>;
  getProfile(userId: string): Promise<{
    profile: ProfileRecord | null;
    error: RoleLookupErrorInfo | null;
  }>;
};

export type RoleUser = {
  id: string;
  email?: string | null;
};

export class RoleLookupError extends Error {
  readonly code = "ROLE_LOOKUP_FAILED";

  constructor(message: string) {
    super(message);
    this.name = "RoleLookupError";
  }
}

export function createAccountRoleLookup(
  supabase: SupabaseClient<Database>,
): AccountRoleLookup {
  return {
    async getAdmin(userId) {
      const { data, error } = await supabase
        .from("admins")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      return {
        found: Boolean(data),
        error: error ? { code: error.code, message: error.message } : null,
      };
    },

    async getTeacher(userId) {
      const { data, error } = await supabase
        .from("teachers")
        .select("id, status, username, email")
        .eq("user_id", userId)
        .maybeSingle();

      return {
        teacher: data,
        error: error ? { code: error.code, message: error.message } : null,
      };
    },

    async getProfile(userId) {
      const { data, error } = await supabase
        .from("account_profiles")
        .select("role, username, email")
        .eq("user_id", userId)
        .maybeSingle();

      return {
        profile: data,
        error: error ? { code: error.code, message: error.message } : null,
      };
    },
  };
}

function readError(
  error: RoleLookupErrorInfo | null,
  table: string,
): void {
  if (error) {
    throw new RoleLookupError(
      `Unable to verify your account access (${table}).`,
    );
  }
}

function normalizeTeacherStatus(status: string): TeacherStatus | null {
  const normalized = status.trim().toLowerCase();

  if (
    normalized === "pending" ||
    normalized === "approved" ||
    normalized === "rejected" ||
    normalized === "suspended"
  ) {
    return normalized;
  }

  return null;
}

function emailPrefix(email: string | null): string | null {
  if (!email) {
    return null;
  }

  return email.split("@")[0] || null;
}

export async function resolveAccountAccess(
  lookup: AccountRoleLookup,
  user: RoleUser,
): Promise<AccountAccess> {
  const [adminResult, teacherResult, profileResult] = await Promise.all([
    lookup.getAdmin(user.id),
    lookup.getTeacher(user.id),
    lookup.getProfile(user.id),
  ]);

  readError(adminResult.error, "admins");
  readError(teacherResult.error, "teachers");
  readError(profileResult.error, "account_profiles");

  const teacher = teacherResult.teacher;
  const profile = profileResult.profile;
  const teacherStatus = teacher
    ? normalizeTeacherStatus(teacher.status)
    : null;
  const email =
    user.email?.trim() || teacher?.email || profile?.email || null;
  const username = teacher?.username || profile?.username || null;
  const displayName =
    username || emailPrefix(email) || "Account";

  if (adminResult.found) {
    return {
      userId: user.id,
      email,
      username,
      displayName,
      role: "admin",
      state: "active",
      teacherId: teacher?.id ?? null,
      teacherStatus,
      hasTeacherRecord: Boolean(teacher),
      hasProfile: Boolean(profile),
    };
  }

  if (teacher) {
    const state =
      teacherStatus === "approved"
        ? "active"
        : teacherStatus === "pending"
          ? "pending"
          : "blocked";

    return {
      userId: user.id,
      email,
      username,
      displayName,
      role: "teacher",
      state,
      teacherId: teacher.id,
      teacherStatus,
      hasTeacherRecord: true,
      hasProfile: Boolean(profile),
    };
  }

  if (profile) {
    const role = profile.role.trim().toLowerCase();

    if (role === "student") {
      return {
        userId: user.id,
        email,
        username,
        displayName,
        role: "student",
        state: "active",
        teacherId: null,
        teacherStatus: null,
        hasTeacherRecord: false,
        hasProfile: true,
      };
    }

    if (role === "teacher") {
      // A teacher profile without a teachers row is an incomplete signup.
      // It is not usable until the row is created.
      return {
        userId: user.id,
        email,
        username,
        displayName,
        role: "teacher",
        state: "blocked",
        teacherId: null,
        teacherStatus: null,
        hasTeacherRecord: false,
        hasProfile: true,
      };
    }

    return {
      userId: user.id,
      email,
      username,
      displayName,
      role: null,
      state: "blocked",
      teacherId: null,
      teacherStatus: null,
      hasTeacherRecord: false,
      hasProfile: true,
    };
  }

  return {
    userId: user.id,
    email,
    username: null,
    displayName: emailPrefix(email) || "Account",
    role: null,
    state: "unregistered",
    teacherId: null,
    teacherStatus: null,
    hasTeacherRecord: false,
    hasProfile: false,
  };
}

export function dashboardPathForRole(role: AccountRole): string {
  if (role === "admin") {
    return "/admin-dashboard";
  }

  if (role === "teacher") {
    return "/teacher-dashboard";
  }

  return "/student-dashboard";
}

export function loginPathForRole(role: AccountRole | null): string {
  if (role === "admin") {
    return "/admin-login";
  }

  if (role === "student") {
    return "/student-login";
  }

  return "/teacher-login";
}

export function destinationForAccess(access: AccountAccess): string {
  if (access.state === "active" && access.role) {
    return dashboardPathForRole(access.role);
  }

  if (access.state === "unregistered") {
    return "/complete-profile";
  }

  const loginPath = loginPathForRole(access.role);
  return `${loginPath}?status=${access.state}`;
}

export function roleFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): "student" | "teacher" | null {
  const role = metadata?.account_role;

  if (typeof role !== "string") {
    return null;
  }

  const normalized = role.trim().toLowerCase();

  if (normalized === "student" || normalized === "teacher") {
    return normalized;
  }

  return null;
}

export function usernameFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  const username = metadata?.username;

  if (typeof username !== "string") {
    return null;
  }

  return username.trim();
}

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username);
}
