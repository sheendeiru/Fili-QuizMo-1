import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  createAccountRoleLookup,
  destinationForAccess,
  isValidUsername,
  resolveAccountAccess,
  roleFromMetadata,
  usernameFromMetadata,
  USERNAME_REQUIREMENTS,
  type AccountAccess,
  type AccountRole,
} from "./roles";

export type ProfileProvisionErrorCode =
  | "invalid_role"
  | "invalid_username"
  | "username_taken"
  | "write_failed";

export type ProfileProvisionResult =
  | {
      ok: true;
      access: AccountAccess;
      destination: string;
    }
  | {
      ok: false;
      code: ProfileProvisionErrorCode;
      message: string;
    };

export type ProfileProvisionInput = {
  role?: "student" | "teacher" | null;
  username?: string | null;
};

function metadataOf(user: User): Record<string, unknown> {
  return (user.user_metadata ?? {}) as Record<string, unknown>;
}

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

function profileError(
  code: ProfileProvisionErrorCode,
  message: string,
): ProfileProvisionResult {
  return { ok: false, code, message };
}

async function currentAccess(
  supabase: SupabaseClient<Database>,
  user: User,
): Promise<ProfileProvisionResult> {
  const access = await resolveAccountAccess(
    createAccountRoleLookup(supabase),
    user,
  );

  return {
    ok: true,
    access,
    destination: destinationForAccess(access),
  };
}

async function createTeacherRow(
  supabase: SupabaseClient<Database>,
  user: User,
  username: string,
): Promise<ProfileProvisionResult | null> {
  const { error } = await supabase.from("teachers").insert({
    user_id: user.id,
    status: "pending",
    username,
    email: user.email ?? null,
  });

  if (isUniqueViolation(error)) {
    return profileError(
      "username_taken",
      "That username is already in use. Choose another one.",
    );
  }

  if (error) {
    return profileError(
      "write_failed",
      "Your teacher profile could not be created. Please try again.",
    );
  }

  return null;
}

export async function ensureAccountProfile(
  supabase: SupabaseClient<Database>,
  user: User,
  input: ProfileProvisionInput = {},
): Promise<ProfileProvisionResult> {
  const metadata = metadataOf(user);
  const requestedRole =
    input.role ?? roleFromMetadata(metadata);
  const requestedUsername = (
    input.username ??
    usernameFromMetadata(metadata) ??
    ""
  ).trim();

  const { data: profile, error: profileErrorResult } = await supabase
    .from("account_profiles")
    .select("role, username, email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileErrorResult) {
    return profileError(
      "write_failed",
      "Your account profile could not be loaded. Please try again.",
    );
  }

  if (profile) {
    const role = profile.role.trim().toLowerCase();

    if (role === "student") {
      return currentAccess(supabase, user);
    }

    if (role !== "teacher") {
      return profileError(
        "invalid_role",
        "This account has an unsupported role. Contact an administrator.",
      );
    }

    const { data: teacher, error: teacherError } = await supabase
      .from("teachers")
      .select("id, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (teacherError) {
      return profileError(
        "write_failed",
        "Your teacher profile could not be loaded. Please try again.",
      );
    }

    if (teacher) {
      return currentAccess(supabase, user);
    }

    // The profile was created but the teachers row was not. Finish the
    // half-completed signup, allowing a new username if the first one was
    // already taken in the teachers table.
    const username =
      requestedUsername || profile.username || "";

    if (!isValidUsername(username)) {
      return profileError("invalid_username", USERNAME_REQUIREMENTS);
    }

    if (profile.username !== username) {
      const { error: updateError } = await supabase
        .from("account_profiles")
        .update({ username })
        .eq("user_id", user.id);

      if (isUniqueViolation(updateError)) {
        return profileError(
          "username_taken",
          "That username is already in use. Choose another one.",
        );
      }

      if (updateError) {
        return profileError(
          "write_failed",
          "Your username could not be updated. Please try again.",
        );
      }
    }

    const teacherFailure = await createTeacherRow(
      supabase,
      user,
      username,
    );

    if (teacherFailure) {
      return teacherFailure;
    }

    return currentAccess(supabase, user);
  }

  if (
    requestedRole !== "student" &&
    requestedRole !== "teacher"
  ) {
    return profileError(
      "invalid_role",
      "Choose whether you are signing up as a student or a teacher.",
    );
  }

  if (!isValidUsername(requestedUsername)) {
    return profileError("invalid_username", USERNAME_REQUIREMENTS);
  }

  const { error: insertError } = await supabase
    .from("account_profiles")
    .insert({
      user_id: user.id,
      role: requestedRole,
      username: requestedUsername,
      email: user.email ?? null,
    });

  if (isUniqueViolation(insertError)) {
    return profileError(
      "username_taken",
      "That username is already in use. Choose another one.",
    );
  }

  if (insertError) {
    return profileError(
      "write_failed",
      "Your account profile could not be created. Please try again.",
    );
  }

  if (requestedRole === "teacher") {
    const teacherFailure = await createTeacherRow(
      supabase,
      user,
      requestedUsername,
    );

    if (teacherFailure) {
      return teacherFailure;
    }
  }

  return currentAccess(supabase, user);
}

export function isProfileRole(
  role: AccountRole,
): role is "student" | "teacher" {
  return role === "student" || role === "teacher";
}
