import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { TeacherLoginForm } from "@/components/auth/teacher-login-form";

export const metadata: Metadata = {
  title: "Teacher Login | Fili-QuizMo",
};

export default function TeacherLoginPage() {
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
            Create an account
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
      <TeacherLoginForm />
    </AuthShell>
  );
}
