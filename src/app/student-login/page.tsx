import type { Metadata } from "next";
import Link from "next/link";
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
      className={`mb-5 text-sm ${confirmed ? "text-success" : "text-danger"}`}
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
          <Link
            href="/signup"
            className="font-semibold text-secondary hover:underline focus-visible:outline"
          >
            Sign up
          </Link>
          <span className="block pt-3">
            Teacher?{" "}
            <Link
              href="/teacher-login"
              className="font-semibold text-secondary hover:underline focus-visible:outline"
            >
              Teacher Log In
            </Link>
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
