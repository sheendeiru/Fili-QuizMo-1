"use client";

import { createClient } from "@/lib/supabase/client";
import { signOutAndReset } from "@/lib/auth/session-state";

export async function logoutAndRedirect(
  router: {
    replace: (href: string) => void;
    refresh: () => void;
  },
  navigate: (action: () => void) => void,
): Promise<void> {
  await signOutAndReset(createClient(), {
    scope: "global",
    broadcast: true,
    redirect: false,
  });
  navigate(() => {
    router.replace("/");
    router.refresh();
  });
}
