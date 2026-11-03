import type { Metadata } from "next";
import { NavLink } from "@/components/pixel";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { StudentLoginForm } from "@/components/auth/student-login-form";

export const metadata: Metadata = {
  title: "Student Login | Fili-QuizMo",
};

type StudentLoginPageProps = {
  searchParams: Promise<{ status?: string | string[] }>;
};

async function LoginStatusContent({
  searchParams,
}: StudentLoginPageProps) {
  const params = await searchParams;
  const status = Array.isArray(params.status)
    ? params.status[0]
    : params.status;

  const message =
    status === "pending"
      ? "Your account is pending administrator approval."
      : status === "blocked"
        ? "Your account is not active. Contact an administrator."
        : status === "session_expired"
          ? "Your session expired. Sign in again to continue."
          : status === "unavailable"
            ? "We could not verify your account access. Please try again."
            : status === "logout_unverified"
              ? "Your browser session was cleared, but server sign-out could not be confirmed."
              : status === "confirmed"
                ? "Email confirmed. Sign in to continue."
                : "";

  if (!message) {
    return null;
  }

  const confirmed = status === "confirmed";
  return (
    <p
      role={confirmed ? "status" : "alert"}
      className={`mb-5 text-sm ${confirmed ? "text-px-grass-text" : "text-danger"}`}
    >
      {message}
    </p>
  );
}

export default function StudentLoginPage({
  searchParams,
}: StudentLoginPageProps) {
  return (
    <AuthShell
      title="Student Login"
      subtitle="Sign in to view your quiz history and scores."
      footer={
        <>
          Need an account?{" "}
          <NavLink
            href="/signup"
            className="font-semibold text-px-gold-text hover:underline focus-visible:outline"
          >
            Sign up
          </NavLink>
          <span className="block pt-3">
            Teacher?{" "}
            <NavLink
              href="/teacher-login"
              className="font-semibold text-px-gold-text hover:underline focus-visible:outline"
            >
              Teacher Log In
            </NavLink>
          </span>
        </>
      }
    >
      <Suspense fallback={null}>
        <LoginStatusContent searchParams={searchParams} />
      </Suspense>
      <StudentLoginForm status={undefined} />
    </AuthShell>
  );
}
