"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { DASHBOARD_DATA_CHANGED_EVENT } from "@/lib/dashboard/realtime-events";

const REFRESH_DELAY_MS = 750;
const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

let channelSequence = 0;

type DashboardRealtimeProps =
  | { role: "admin"; teacherId?: undefined }
  | { role: "teacher"; teacherId: number };

/**
 * Refreshes dashboard data when watched tables change. RLS limits the rows
 * Realtime delivers, so the same subscriptions are safe for both roles.
 */
export function DashboardRealtime({ role, teacherId }: DashboardRealtimeProps) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = RECONNECT_BASE_MS;
    let disposed = false;

    function scheduleRefresh() {
      if (refreshTimer) return;

      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        window.dispatchEvent(new Event(DASHBOARD_DATA_CHANGED_EVENT));
        router.refresh();
      }, REFRESH_DELAY_MS);
    }

    function connect() {
      if (disposed) return;

      channelSequence += 1;
      const nextChannel = supabase.channel(
        `dashboard-live-${role}-${teacherId ?? "all"}-${channelSequence}`,
      );
      channel = nextChannel;

      const tables =
        role === "admin"
          ? ["quizzes", "quiz_results", "students", "teachers"]
          : ["quizzes", "quiz_results", "students"];

      for (const table of tables) {
        nextChannel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            ...(role === "teacher" && table === "quizzes"
              ? { filter: `teacher_id=eq.${teacherId}` }
              : {}),
          },
          scheduleRefresh,
        );
      }

      nextChannel.subscribe((status) => {
        if (disposed) return;

        if (status === "SUBSCRIBED") {
          reconnectDelay = RECONNECT_BASE_MS;
          return;
        }

        if (status !== "CHANNEL_ERROR" && status !== "TIMED_OUT") return;

        if (channel === nextChannel) channel = null;
        void supabase.removeChannel(nextChannel);
        if (reconnectTimer) return;

        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
      });
    }

    connect();

    return () => {
      disposed = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [role, teacherId, router]);

  return null;
}
