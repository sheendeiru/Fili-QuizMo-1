"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export const IN_APP_NAV_KEY = "fq:in-app-nav";

export function NavTracker() {
  const pathname = usePathname();
  const previous = useRef(pathname);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    try {
      sessionStorage.setItem(IN_APP_NAV_KEY, "1");
    } catch {
      // storage unavailable; the referrer check still applies
    }
  }, [pathname]);

  return null;
}
