import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { StudentLoginForm } from "@/components/auth/student-login-form";

export const metadata: Metadata = {
  title: "Student Login | Fili-QuizMo",
};

export default function StudentLoginPage() {
  return (
    <AuthShell
      title="Student Login"
      subtitle="Sign in to continue to your quizzes."
      footer={
        <>
          Teacher?{" "}
          <Link
            href="/teacher-login"
            className="font-semibold text-secondary hover:underline focus-visible:outline"
          >
            Teacher Log In
          </Link>
        </>
      }
    >
      <StudentLoginForm />
    </AuthShell>
  );
}
