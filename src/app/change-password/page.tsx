import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export const metadata: Metadata = {
  title: "Change Password | Fili-QuizMo",
};

export default function ChangePasswordPage() {
  return (
    <AuthShell
      title="Change Password"
      subtitle="Reset your password or choose a new one."
      footer={
        <Link
          href="/teacher-login"
          className="font-semibold text-secondary hover:underline focus-visible:outline"
        >
          Back to login
        </Link>
      }
    >
      <ChangePasswordForm />
    </AuthShell>
  );
}
