"use client";

import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/layout/brand-logo";
import { PixelAvatar } from "@/components/pixel/primitives";
import { ExportDropdown } from "@/components/dashboard/export-dropdown";
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
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const asideRef = useRef<HTMLElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const confirmDialogRef = useRef<HTMLDivElement>(null);
  const wasSidebarOpen = useRef(false);

  // Focus "Cancel" (the first button) when the log out confirmation opens, so Enter never logs out by accident.
  useEffect(() => {
    if (confirmLogoutOpen) {
      confirmDialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    }
  }, [confirmLogoutOpen]);

  // Move focus into the drawer when it opens, and back to the hamburger when it closes.
  useEffect(() => {
    if (sidebarOpen) {
      asideRef.current?.querySelector<HTMLElement>("nav button")?.focus();
    } else if (wasSidebarOpen.current) {
      hamburgerRef.current?.focus();
    }
    wasSidebarOpen.current = sidebarOpen;
  }, [sidebarOpen]);

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

  // Escape closes the sidebar, the profile menu and the log out confirmation.
  useEffect(() => {
    if (!sidebarOpen && !profileOpen && !confirmLogoutOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;

      setSidebarOpen(false);
      setProfileOpen(false);
      if (confirmLogoutOpen) {
        setConfirmLogoutOpen(false);
        profileButtonRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen, profileOpen, confirmLogoutOpen]);

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

  function openLogoutConfirm() {
    setProfileOpen(false);
    setConfirmLogoutOpen(true);
  }

  function closeLogoutConfirm() {
    setConfirmLogoutOpen(false);
    profileButtonRef.current?.focus();
  }

  async function confirmLogout() {
    setConfirmLogoutOpen(false);
    await handleLogout();
  }

  // Keep Tab inside the confirmation while it is open.
  function handleConfirmKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;

    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>("button"),
    );
    const first = buttons[0];
    const last = buttons[buttons.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-30 bg-black/40"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      {/* Slide-in drawer on every screen size, closed by default. `inert` keeps its buttons out of the tab order while hidden. */}
      <aside
        id="dashboard-sidebar"
        ref={asideRef}
        inert={!sidebarOpen}
        className={`fixed inset-y-0 left-0 z-40 flex w-56 shrink-0 flex-col overflow-y-auto bg-ink text-surface transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center border-b border-surface/20 px-3">
          <div className="flex min-w-0 items-center">
            <BrandLogo linked={false} priority className="h-10 w-48" />
          </div>
        </div>

        {/* Equal-height rows (the tallest label sets the height) with room for each button's pixel shadow. */}
        <nav aria-label="Dashboard sections" className="grid auto-rows-fr gap-3 p-3">
          {navItems.map((item) => {
            const isActive = item.key === activeKey;

            return (
              <Button
                key={item.key}
                type="button"
                size="sm"
                variant={isActive ? "accent" : "neutral"}
                aria-current={isActive ? "page" : undefined}
                onClick={() => handleNavigate(item.key)}
                className="w-full justify-start text-left"
              >
                {item.label}
              </Button>
            );
          })}
        </nav>

        <div className="flex-1" />

        <div className="shrink-0 border-t border-surface/20 p-3">
          <p className="text-xs uppercase tracking-wide text-surface">
            {role} Portal
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b-2 border-ink bg-surface px-3 shadow-[0_3px_0_var(--color-ink)] sm:px-4">
          <div className="flex items-center gap-3">
            <button
              ref={hamburgerRef}
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
              aria-controls="dashboard-sidebar"
              aria-expanded={sidebarOpen}
              className="inline-flex h-9 w-9 items-center justify-center text-ink transition-colors border border-ink border-2, border-4 hover:bg-neutral-100"
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
              ref={profileButtonRef}
              type="button"
              onClick={() => setProfileOpen((prev) => !prev)}
              aria-label="Open profile menu"
              aria-expanded={profileOpen}
              className="flex items-center border border-ink focus:outline-none"
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
                  onClick={openLogoutConfirm}
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
            ["quizzes", "students"].includes(activeKey)) ||
            (role === "Admin" &&
              [
                "quizzes",
                "teacher-accounts",
                "students",
              ].includes(activeKey))) ? (
            <div className="mb-3 flex justify-end">
              <ExportDropdown role={role === "Teacher" ? "teacher" : "admin"} />
            </div>
          ) : null}
          {children}
        </main>
      </div>

      {confirmLogoutOpen ? (
        <div
          role="presentation"
          className="fixed inset-0 z-[55] flex items-center justify-center bg-black/40 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeLogoutConfirm();
            }
          }}
        >
          <div
            ref={confirmDialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="logout-confirm-title"
            aria-describedby="logout-confirm-description"
            onKeyDown={handleConfirmKeyDown}
            className="w-full max-w-sm border-2 border-ink bg-surface p-4 text-ink shadow-[3px_3px_0_var(--color-ink)]"
          >
            <h2 id="logout-confirm-title" className="text-lg font-bold">
              Log out?
            </h2>
            <p id="logout-confirm-description" className="mt-2 text-sm">
              You will need to sign in again to open your{" "}
              {role.toLowerCase()} dashboard.
            </p>
            <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={closeLogoutConfirm}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={() => void confirmLogout()}>
                Yes, log out
              </Button>
            </div>
          </div>
        </div>
      ) : null}

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
