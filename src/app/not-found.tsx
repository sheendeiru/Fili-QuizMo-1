import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";

export default function NotFound() {
  return (
    <AuthShell
      title="404 - Level Not Found"
      subtitle="That page is not part of this game."
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
        Check the address or head back to the home screen.
      </p>
    </AuthShell>
  );
}
