import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";

export default function Forbidden() {
  return (
    <AuthShell
      title="Access Denied"
      subtitle="This account does not have permission to view this page."
      footer={
        <Link
          href="/"
          className="font-semibold text-secondary hover:underline focus-visible:outline"
        >
          Return home
        </Link>
      }
    >
      <p className="text-sm text-neutral-500">
        If you believe this is a mistake, contact your Fili-QuizMo
        administrator.
      </p>
    </AuthShell>
  );
}
