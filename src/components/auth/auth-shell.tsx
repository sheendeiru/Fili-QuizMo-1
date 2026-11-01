import type { ReactNode } from "react";
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
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
        <div className="w-full max-w-md bg-white p-6 shadow-lg sm:p-8">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">{subtitle}</p>
          <div className="mt-8">
            <SessionExpiredNotice />
            {children}
          </div>
          {footer ? (
            <div className="mt-6 text-center text-sm text-neutral-500">
              {footer}
            </div>
          ) : null}
        </div>
      </main>

      <Footer />
    </div>
  );
}
