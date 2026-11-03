"use client";

import { useSyncExternalStore } from "react";
import { COOKIE_NOTICE_STORAGE_KEY } from "@/lib/legal/policy-version";
import { NavLink } from "@/components/pixel";

const COOKIE_NOTICE_CHANGE_EVENT = "fili-quizmo-cookie-notice-change";
let dismissedInCurrentTab = false;

function getDismissedSnapshot() {
  if (dismissedInCurrentTab) return true;

  try {
    return window.localStorage.getItem(COOKIE_NOTICE_STORAGE_KEY) === "true";
  } catch (error) {
    console.error("Could not read the cookie notice preference.", error);
    return false;
  }
}

function subscribeToDismissalChange(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(COOKIE_NOTICE_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(COOKIE_NOTICE_CHANGE_EVENT, onChange);
  };
}

export function CookieNotice() {
  const dismissed = useSyncExternalStore(
    subscribeToDismissalChange,
    getDismissedSnapshot,
    () => false,
  );

  function dismiss() {
    dismissedInCurrentTab = true;
    try {
      window.localStorage.setItem(COOKIE_NOTICE_STORAGE_KEY, "true");
    } catch (error) {
      console.error("Could not save the cookie notice preference.", error);
    }
    window.dispatchEvent(new Event(COOKIE_NOTICE_CHANGE_EVENT));
  }

  if (dismissed) return null;

  return (
    <aside
      aria-label="Cookie information"
      className="fixed inset-x-3 bottom-3 z-[70] mx-auto flex max-w-3xl flex-col gap-3 border-2 border-px-cream bg-px-indigo p-4 text-px-cream shadow-[4px_4px_0_var(--px-ink)] sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm">
        Fili-QuizMo uses strictly necessary authentication cookies.{" "}
        <NavLink
          href="/cookies"
          className="font-semibold text-px-gold underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-px-gold"
        >
          Read our Cookie Policy.
        </NavLink>
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="pixel-border min-h-11 shrink-0 border-2 border-px-cream bg-transparent px-4 py-2 text-sm text-px-cream hover:bg-px-indigo-lt active:bg-px-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-px-gold"
      >
        Dismiss
      </button>
    </aside>
  );
}
