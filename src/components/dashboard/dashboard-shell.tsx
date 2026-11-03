"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/layout/brand-logo";
import { PixelAvatar } from "@/components/pixel/primitives";
import { ExportDropdown } from "@/components/dashboard/export-dropdown";
import { NavLink } from "@/components/pixel";
import { getSessionEpoch } from "@/lib/auth/session-state";

export type DashboardNavItem = {
  key: string;
  label: string;
};

type DashboardShellProps = {
  role: "Teacher" | "Admin" | "Student";
  navItems: DashboardNavItem[];
  activeKey: string;
  onNavigate: (key: string) => void;
  onLogout: () => void | Promise<void>;
  children: ReactNode;
};

export function DashboardShell({
  role,
  navItems,
  activeKey,
  onNavigate,
  onLogout,
  children,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    const historyState: unknown = window.history.state;
    const state =
      typeof historyState === "object" && historyState !== null
        ? historyState
        : {};

    window.history.replaceState(
      {
        ...state,
        filiQuizMoSessionEpoch: getSessionEpoch(),
      },
      "",
      window.location.href,
    );
  }, [pathname, search]);

  function handleNavigate(key: string) {
    onNavigate(key);
    setSidebarOpen(false);
    setProfileOpen(false);
  }

  async function handleLogout() {
    setProfileOpen(false);
    setIsLoggingOut(true);

    try {
      await onLogout();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-56 shrink-0 flex-col overflow-y-auto bg-ink text-surface transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center border-b border-surface/20 px-3">
          <div className="flex min-w-0 items-center">
            <BrandLogo linked={false} priority className="h-10 w-48" />
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const isActive = item.key === activeKey;

            return (
              <Button
                key={item.key}
                type="button"
                size="sm"
                variant={isActive ? "accent" : "neutral"}
                onClick={() => handleNavigate(item.key)}
                className="w-full justify-start text-left"
              >
                {item.label}
              </Button>
            );
          })}
        </nav>

        <div className="border-t border-surface/20 p-3">
          <p className="text-xs uppercase tracking-wide text-surface">
            {role} Portal
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b-2 border-ink bg-surface px-3 shadow-[0_3px_0_var(--color-ink)] sm:px-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
              className="inline-flex h-9 w-9 items-center justify-center text-ink transition-colors hover:bg-neutral-100 lg:hidden"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <h1 className="text-base font-semibold text-ink">
              {role} Dashboard
            </h1>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileOpen((prev) => !prev)}
              aria-label="Open profile menu"
              aria-expanded={profileOpen}
              className="flex items-center focus:outline-none"
            >
              <PixelAvatar
                name={`${role} profile`}
                className="h-9 w-9 shrink-0 border-ink"
              />
            </button>

            {profileOpen ? (
              <div className="absolute right-0 mt-2 w-44 overflow-hidden border-2 border-ink bg-surface py-1 text-ink shadow-[3px_3px_0_var(--color-ink)]">
                {role !== "Student" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="neutral"
                    onClick={() => handleNavigate("settings")}
                    className="w-full justify-start text-left"
                  >
                    Settings
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  onClick={handleLogout}
                  className="w-full justify-start text-left"
                >
                  Log out
                </Button>
              </div>
            ) : null}
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 p-3 sm:p-4">
          {role !== "Student" &&
          ((role === "Teacher" &&
            ["quizzes", "students", "participants"].includes(activeKey)) ||
            (role === "Admin" &&
              [
                "quizzes",
                "teacher-accounts",
                "students",
                "participants",
              ].includes(activeKey))) ? (
            <div className="mb-3 flex justify-end">
              <ExportDropdown role={role === "Teacher" ? "teacher" : "admin"} />
            </div>
          ) : null}
          {children}
        </main>
        <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t-2 border-px-cream-border px-4 py-4 text-sm text-px-cream">
          <NavLink
            href="/terms"
            className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-px-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-px-gold"
          >
            Terms
          </NavLink>
          <NavLink
            href="/privacy"
            className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-px-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-px-gold"
          >
            Privacy
          </NavLink>
          <NavLink
            href="/cookies"
            className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-px-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-px-gold"
          >
            Cookies
          </NavLink>
        </footer>
      </div>

      {isLoggingOut ? (
        <div
          role="status"
          aria-live="polite"
          className="pixel-grid fixed inset-0 z-[60] flex items-center justify-center bg-px-ink/80 px-4"
        >
          <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-2xl">
            <Spinner className="h-5 w-5 text-primary" />
            <p className="text-sm font-semibold text-foreground">
              Logging out...
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
