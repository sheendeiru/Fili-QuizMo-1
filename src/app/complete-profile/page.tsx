import type { Metadata } from "next";
import { NavLink } from "@/components/pixel";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { CompleteProfileForm } from "@/components/auth/complete-profile-form";
import { isInvalidSession } from "@/lib/auth/session-errors";
import {
  createAccountRoleLookup,
  destinationForAccess,
  resolveAccountAccess,
  roleFromMetadata,
  usernameFromMetadata,
} from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Finish Account Setup | Fili-QuizMo",
};

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function reasonMessage(reason?: string): string {
  if (reason === "username_taken") {
    return "That username is already in use. Choose another one.";
  }

  if (reason === "profile_error") {
    return "We could not finish setting up your profile. Please try again.";
  }

  if (reason === "session_expired") {
    return "Your session expired. Sign in again to finish setting up your profile.";
  }

  return "";
}

type CompleteProfilePageProps = {
  searchParams: Promise<{
    reason?: string | string[];
  }>;
};

async function CompleteProfileContent({
  searchParams,
}: CompleteProfilePageProps) {
  const params = await searchParams;
  const reason = firstParam(params.reason);
  const message = reasonMessage(reason);

  return message ? (
    <p role="alert" className="mb-5 text-sm text-danger">
      {message}
    </p>
  ) : null;
}

export default async function CompleteProfilePage({
  searchParams,
}: CompleteProfilePageProps) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError && !isInvalidSession(userError)) {
    throw userError;
  }

  if (!user) {
    redirect("/signup?status=session_expired");
  }

  const access = await resolveAccountAccess(
    createAccountRoleLookup(supabase),
    user,
  );

  if (access.state === "active" || access.state === "pending") {
    redirect(destinationForAccess(access));
  }

  if (
    access.state === "blocked" &&
    (access.hasTeacherRecord || access.role !== "teacher")
  ) {
    redirect(destinationForAccess(access));
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const initialRole =
    roleFromMetadata(metadata) ??
    (access.role === "teacher" ? "teacher" : "student");
  const initialUsername =
    usernameFromMetadata(metadata) ?? access.username ?? "";
  const roleLocked = access.role === "teacher";

  return (
    <AuthShell
      title="Finish Account Setup"
      subtitle="Choose your account type and username to complete your profile."
      footer={
        <>
          Wrong account?{" "}
          <NavLink
            href="/signup"
            className="font-semibold text-secondary hover:underline focus-visible:outline"
          >
            Return to signup
          </NavLink>
        </>
      }
    >
      <Suspense fallback={null}>
        <CompleteProfileContent
          searchParams={searchParams}
        />
      </Suspense>
      <CompleteProfileForm
        email={user.email ?? null}
        initialRole={initialRole}
        initialUsername={initialUsername}
        roleLocked={roleLocked}
      />
    </AuthShell>
  );
}
