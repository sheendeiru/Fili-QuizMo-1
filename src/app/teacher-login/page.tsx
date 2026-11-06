import type { Metadata } from "next";
import { NavLink } from "@/components/pixel";
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
      className={`mb-5 text-sm ${confirmed ? "text-px-grass-text" : "text-danger"}`}
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
          <NavLink
            href="/signup"
            className="font-semibold text-color--ink hover:underline"
          >
            Request an account
          </NavLink>
          <span className="block pt-3">
            Are you a student?{" "}
            <NavLink
              href="/student-login"
              className="font-semibold text-color--ink hover:underline focus-visible:outline"
            >
              Student Log In
            </NavLink>
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