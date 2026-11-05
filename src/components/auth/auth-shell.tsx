import type { ReactNode } from "react";
import Image from "next/image";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { SessionExpiredNotice } from "@/components/auth/session-expired-notice";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="auth-page flex min-h-screen flex-col bg-background">
      <Navbar />

      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center px-4 py-6 sm:px-6">
        <div className="w-full max-w-md border-2 border-ink bg-surface p-4 text-ink shadow-[4px_4px_0_var(--color-ink)] sm:p-5">
          <div className="mb-3 flex justify-center">
            <Image
              src="/assets/Fili-QuizMo Logo.png"
              alt=""
              aria-hidden="true"
              width={940}
              height={2048}
              className="h-16 w-16 object-cover object-[50%_39%]"
              priority
            />
          </div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">
            {title}
          </h1>
          <p className="mt-1 text-sm text-ink">{subtitle}</p>
          <div className="mt-4">
            <SessionExpiredNotice />
            {children}
          </div>
          {footer ? (
            <div className="mt-4 text-center text-sm text-ink">
              {footer}
            </div>
          ) : null}
        </div>
      </main>

      <Footer />
    </div>
  );
}
