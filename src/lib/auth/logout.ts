"use client";

import { createClient } from "@/lib/supabase/client";
import { signOutAndReset } from "@/lib/auth/session-state";

export async function logoutAndRedirect(
  router: {
    replace: (href: string) => void;
    refresh: () => void;
  },
): Promise<void> {
  await signOutAndReset(createClient(), {
    scope: "global",
    broadcast: true,
    redirect: false,
  });
  router.replace("/");
  router.refresh();
}
