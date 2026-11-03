import type { Metadata } from "next";
import { NavLink } from "@/components/pixel";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = {
  title: "Email Confirmation Failed | Fili-QuizMo",
};

export default function AuthErrorPage() {
  return (
    <AuthShell
      title="Email Confirmation Failed"
      subtitle="This confirmation link is invalid or has expired."
      footer={
        <>
          Need to sign in?{" "}
          <NavLink
            href="/teacher-login"
            className="font-semibold text-secondary hover:underline focus-visible:outline"
          >
            Teacher login
          </NavLink>
          <span className="block pt-3">
            Student?{" "}
            <NavLink
              href="/student-login"
              className="font-semibold text-secondary hover:underline focus-visible:outline"
            >
              Student login
            </NavLink>
          </span>
        </>
      }
    >
      <p className="text-sm text-neutral-500">
        If you already confirmed your email, sign in below. Otherwise, sign up
        again to request a new confirmation email, or contact your Fili-QuizMo
        administrator if the problem continues.
      </p>
    </AuthShell>
  );
}
