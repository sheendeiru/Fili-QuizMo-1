"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SESSION_ENDED_EVENT } from "@/lib/auth/session-state";

// The last dashboard path per role for this page load keeps browser Back
// working, while a reload starts clean and keeps deep-linked filters.
const lastPathname = new Map<string, string>();

export function takeRouteReset(
  scope: string,
  pathname: string,
  currentHref: string,
  cleanHref: string,
): string | null {
  const previous = lastPathname.get(scope);
  lastPathname.set(scope, pathname);

  if (previous === undefined || previous === pathname) {
    return null;
  }

  return currentHref === cleanHref ? null : cleanHref;
}

/** Strip filter/pagination state when a dashboard section is re-entered. */
export function useResetRouteState(scope: string, cleanHref: string): void {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const target = takeRouteReset(
      scope,
      pathname,
      `${window.location.pathname}${window.location.search}`,
      cleanHref,
    );

    if (target) {
      router.replace(target, { scroll: false });
    }
  }, [cleanHref, pathname, router, scope]);

  useEffect(() => {
    function forgetRoute() {
      lastPathname.delete(scope);
    }

    window.addEventListener(SESSION_ENDED_EVENT, forgetRoute);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, forgetRoute);
  }, [scope]);
}
