"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DASHBOARD_DATA_CHANGED_EVENT } from "@/lib/dashboard/realtime-events";

const REFRESH_DELAY_MS = 800;

/**
 * Keeps a server-rendered dashboard live. When any row in one of the given
 * tables changes, the page's server data is re-fetched (router.refresh), so
 * stat cards, charts and rankings update without a manual reload. Client
 * state such as filters and open sections is preserved. The same change is
 * also announced with DASHBOARD_DATA_CHANGED_EVENT, which is what makes the
 * searchable tables (useSearchFilters) reload their rows.
 *
 * Supabase only sends changes for rows the signed-in user is allowed to read
 * (row level security), and the tables must be in the supabase_realtime
 * publication (see realtime.sql). The payload is ignored on purpose: the
 * server query is the single source of truth.
 */
export function useRealtimeRefresh(tables: readonly string[]) {
  const router = useRouter();
  const tableKey = tables.join(",");

  useEffect(() => {
    const supabase = createClient();
    let timer: number | undefined;
    let pendingWhileHidden = false;

    function refreshNow() {
      pendingWhileHidden = false;
      router.refresh();
      window.dispatchEvent(new Event(DASHBOARD_DATA_CHANGED_EVENT));
    }

    function scheduleRefresh() {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (document.visibilityState === "hidden") {
          // No need to fetch for a tab nobody is looking at.
          pendingWhileHidden = true;
          return;
        }
        refreshNow();
      }, REFRESH_DELAY_MS);
    }

    function handleVisibility() {
      if (document.visibilityState === "visible" && pendingWhileHidden) {
        scheduleRefresh();
      }
    }

    // A unique name per effect run keeps React Strict Mode's double mount
    // from reusing a channel that is being torn down.
    const channelName = `dashboard-live-${Math.random().toString(36).slice(2)}`;
    let channel = supabase.channel(channelName);

    for (const table of tableKey.split(",")) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        scheduleRefresh,
      );
    }

    channel.subscribe();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
      void supabase.removeChannel(channel);
    };
  }, [tableKey, router]);
}
