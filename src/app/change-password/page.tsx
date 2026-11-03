import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { SafeReturnLink } from "@/components/auth/safe-return-link";
import { safeInternalPath } from "@/lib/safe-redirect";

export const metadata: Metadata = {
  title: "Change Password | Fili-QuizMo",
};

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const params = await searchParams;
  const returnToValue = Array.isArray(params.returnTo)
    ? params.returnTo[0]
    : params.returnTo;
  const returnTo = safeInternalPath(returnToValue);

  return (
    <AuthShell
      title="Change Password"
      subtitle="Reset your password or choose a new one."
      footer={
        <SafeReturnLink returnTo={returnTo} />
      }
    >
      <ChangePasswordForm returnTo={returnTo} />
    </AuthShell>
  );
}
