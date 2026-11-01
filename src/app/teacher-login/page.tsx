import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { TeacherLoginForm } from "@/components/auth/teacher-login-form";

export const metadata: Metadata = {
  title: "Teacher Login | Fili-QuizMo",
};

type TeacherLoginPageProps = {
  searchParams: Promise<{ status?: string | string[] }>;
};

async function LoginStatusContent({
  searchParams,
}: TeacherLoginPageProps) {
  const params = await searchParams;
  const status = Array.isArray(params.status)
    ? params.status[0]
    : params.status;

  const message =
    status === "pending"
      ? "Your teacher account is pending administrator approval."
      : status === "blocked"
        ? "Your teacher account is not active. Contact an administrator."
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

export default function TeacherLoginPage({
  searchParams,
}: TeacherLoginPageProps) {
  return (
    <AuthShell
      title="Teacher Login"
      subtitle="Sign in to manage quizzes, students, and scores."
      footer={
        <>
          Are you new here?{" "}
          <Link
            href="/signup"
            className="font-semibold text-primary hover:underline"
          >
            Request an account
          </Link>
          <span className="block pt-3">
            Are you a student?{" "}
            <Link
              href="/student-login"
              className="font-semibold text-secondary hover:underline focus-visible:outline"
            >
              Student Log In
            </Link>
          </span>
        </>
      }
    >
      <Suspense fallback={null}>
        <LoginStatusContent searchParams={searchParams} />
      </Suspense>
      <TeacherLoginForm status={undefined} />
    </AuthShell>
  );
}
