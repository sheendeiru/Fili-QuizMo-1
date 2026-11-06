import type { Metadata } from "next";
import { NavLink } from "@/components/pixel";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create Account | Fili-QuizMo",
};

type SignupPageProps = {
  searchParams: Promise<{ status?: string | string[] }>;
};

async function SignupStatusMessage({
  searchParams,
}: SignupPageProps) {
  const params = await searchParams;
  const status = Array.isArray(params.status)
    ? params.status[0]
    : params.status;

  if (status !== "session_expired") {
    return null;
  }

  return (
    <p role="alert" className="mb-5 text-sm text-danger">
      Your session expired. Sign in again to finish setting up your profile.
    </p>
  );
}

export default function SignupPage({ searchParams }: SignupPageProps) {
  return (
    <AuthShell
      title="Create Account"
      subtitle="Join Fili-QuizMo as a student or request a teacher account."
      footer={
        <>
          Already have an account?{" "}
          <NavLink
            href="/student-login"
            className="font-semibold text-secondary hover:underline focus-visible:outline"
          >
            Student login
          </NavLink>
          <span className="block pt-3">
            Are you a teacher?{" "}
            <NavLink
              href="/teacher-login"
              className="font-semibold text-color--ink hover:underline"
            >
              Teacher login
            </NavLink>
          </span>
        </>
      }
    >
      <Suspense fallback={null}>
        <SignupStatusMessage searchParams={searchParams} />
      </Suspense>
      <SignupForm />
    </AuthShell>
  );
}
