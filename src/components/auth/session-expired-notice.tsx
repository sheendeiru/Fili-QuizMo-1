"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { resetSessionState } from "@/lib/auth/session-state";

export function SessionExpiredNotice() {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (
      params.get("error") !== "session-expired" &&
      params.get("status") !== "session_expired"
    ) {
      return;
    }

    void resetSessionState({ broadcast: true });
    const timer = window.setTimeout(() => setVisible(true), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  if (!visible) {
    return null;
  }

  return (
    <p
      role="status"
      className="mb-5 border-2 border-warning bg-surface p-3 text-sm text-foreground"
    >
      Your session expired while exporting. Sign in again to continue.
    </p>
  );
}
