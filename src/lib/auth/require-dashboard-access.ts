import { forbidden, redirect } from "next/navigation";
import { connection } from "next/server";
import { isInvalidSession } from "@/lib/auth/session-errors";
import {
  createAccountRoleLookup,
  loginPathForRole,
  resolveAccountAccess,
  type AccountAccess,
  type AccountRole,
} from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

async function requireAccess(
  expectedRole: AccountRole,
) {
  // Auth pages render per request; this stops Next's PPR shell from touching
  // Supabase's Date.now()-based session code during prerendering.
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError && !isInvalidSession(userError)) {
    throw userError;
  }

  if (!user) {
    redirect("/");
  }

  const access: AccountAccess = await resolveAccountAccess(
    createAccountRoleLookup(supabase),
    user,
  );

  if (access.state === "unregistered") {
    redirect("/complete-profile");
  }

  if (access.state !== "active") {
    redirect(`${loginPathForRole(access.role)}?status=${access.state}`);
  }

  if (access.role !== expectedRole) {
    forbidden();
  }

  if (expectedRole === "admin") {
    const { data: assurance, error: assuranceError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (assuranceError) {
      throw assuranceError;
    }

    if (assurance.currentLevel !== "aal2") {
      redirect("/admin-login?mfa=required");
    }
  }

  return { user, access };
}

export async function requireTeacherAccess() {
  return requireAccess("teacher");
}

export async function requireAdminAccess() {
  return requireAccess("admin");
}

export async function requireStudentAccess() {
  return requireAccess("student");
}
