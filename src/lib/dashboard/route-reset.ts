"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SESSION_ENDED_EVENT } from "@/lib/auth/session-state";

// The first dashboard route in a page load keeps deep-linked filters. Every
// later entry into a section starts clean.
const lastHref = new Map<string, string>();

export function shouldResetRoute(
  scope: string,
  currentHref: string,
  cleanHref: string,
): boolean {
  const previousHref = lastHref.get(scope);
  lastHref.set(scope, currentHref);

  // Ignore repeat runs for the same navigation (Strict Mode, re-renders).
  if (previousHref === undefined || previousHref === currentHref) {
    return false;
  }

  return currentHref !== cleanHref;
}

/** Strip filter/pagination state when a dashboard section is re-entered. */
export function useResetRouteState(scope: string, cleanHref: string): void {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const currentHref = `${window.location.pathname}${window.location.search}`;

    if (shouldResetRoute(scope, currentHref, cleanHref)) {
      router.replace(cleanHref, { scroll: false });
    }
  }, [cleanHref, pathname, router, scope]);

  useEffect(() => {
    function forgetRoute() {
      lastHref.delete(scope);
    }

    window.addEventListener(SESSION_ENDED_EVENT, forgetRoute);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, forgetRoute);
  }, [scope]);
}
