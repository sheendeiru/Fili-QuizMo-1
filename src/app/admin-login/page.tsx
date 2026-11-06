import type { Metadata } from "next";
import { NavLink } from "@/components/pixel";
import { Suspense } from "react";
import { AdminLoginForm } from "@/components/auth/admin-login-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Admin Login | Fili-QuizMo",
};

type AdminLoginPageProps = {
  searchParams: Promise<{
    status?: string | string[];
    mfa?: string | string[];
  }>;
};

async function LoginStatusContent({
  searchParams,
}: AdminLoginPageProps) {
  const params = await searchParams;
  const status = Array.isArray(params.status)
    ? params.status[0]
    : params.status;
  const mfa = Array.isArray(params.mfa)
    ? params.mfa[0]
    : params.mfa;

  const message =
    status === "blocked"
      ? "This account is not authorized for admin access."
      : status === "session_expired"
        ? "Your session expired. Sign in again to continue."
        : status === "unavailable"
          ? "We could not verify your account access. Please try again."
          : status === "logout_unverified"
            ? "Your browser session was cleared, but server sign-out could not be confirmed."
            : mfa === "required"
              ? "Complete multi-factor authentication to access the admin dashboard."
              : "";

  return message ? (
    <p
      role={mfa === "required" ? "status" : "alert"}
      className={`mb-5 text-sm ${mfa === "required" ? "text-px-grass-text" : "text-danger"}`}
    >
      {message}
    </p>
  ) : null;
}

export default function AdminLoginPage({
  searchParams,
}: AdminLoginPageProps) {
  return (
    <AuthShell
      title="Admin Login"
      subtitle="Sign in to manage quizzes, teacher data, and accounts."
      footer={
        <>
          Need the teacher portal?{" "}
          <NavLink
            href="/teacher-login"
            className="font-semibold text-color--ink hover:underline"
          >
            Login
          </NavLink>
        </>
      }
    >
      <Suspense fallback={null}>
        <LoginStatusContent searchParams={searchParams} />
      </Suspense>
      <AdminLoginForm status={undefined} mfaRequired={false} />
    </AuthShell>
  );
}
