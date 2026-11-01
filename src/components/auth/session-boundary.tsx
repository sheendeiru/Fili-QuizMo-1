"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getSessionEpoch,
  hasSessionEndedMarker,
  isSigningOut,
  resetSessionState,
  sessionLoginPath,
} from "@/lib/auth/session-state";

const SESSION_CHANNEL_NAME = "fili-quizmo-session";
const SESSION_STORAGE_PING = "fili-quizmo-session-reset";

export function SessionBoundary() {
  const currentPathname = usePathname();

  useEffect(() => {
    let currentUserId: string | null = null;
    const pathname = currentPathname;
    const loginPath = sessionLoginPath(pathname);
    const isDashboardPath = [
      "/admin-dashboard",
      "/teacher-dashboard",
      "/student-dashboard",
    ].some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
    const pageSessionEpoch = getSessionEpoch();

    function endCurrentPageSession() {
      if (loginPath) {
        document.documentElement.style.visibility = "hidden";
      }

      void resetSessionState({
        broadcast: false,
        redirectTo: isDashboardPath ? "/" : loginPath,
      });
    }

    function handlePageShow(event: PageTransitionEvent) {
      if (
        !event.persisted ||
        (!hasSessionEndedMarker() && pageSessionEpoch === getSessionEpoch())
      ) {
        return;
      }

      document.documentElement.style.visibility = "hidden";
      window.location.replace(pathname);
    }

    function handleStorage(event: StorageEvent) {
      if (event.key === SESSION_STORAGE_PING && event.newValue) {
        endCurrentPageSession();
      }
    }

    function handlePopState() {
      const currentPath = window.location.pathname;
      const historyState: unknown = window.history.state;
      const entryEpoch =
        typeof historyState === "object" &&
        historyState !== null &&
        "filiQuizMoSessionEpoch" in historyState
          ? historyState.filiQuizMoSessionEpoch
          : null;

      if (
        sessionLoginPath(currentPath) &&
        (hasSessionEndedMarker() ||
          (typeof entryEpoch === "number" &&
            entryEpoch !== getSessionEpoch()))
      ) {
        document.documentElement.style.visibility = "hidden";
        window.location.replace("/");
      }
    }

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("popstate", handlePopState);

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        channel = new BroadcastChannel(SESSION_CHANNEL_NAME);
      }
    } catch {
      console.error("Could not listen for cross-tab session changes.");
    }
    if (channel) {
      channel.onmessage = (event: MessageEvent<{ type?: string }>) => {
        if (event.data?.type === "SESSION_ENDED") {
          endCurrentPageSession();
        }
      };
    }

    const { data } = createClient().auth.onAuthStateChange(
      (event, session) => {
        const nextUserId = session?.user.id ?? null;

        if (event === "INITIAL_SESSION") {
          currentUserId = nextUserId;
          if (loginPath && hasSessionEndedMarker()) {
            endCurrentPageSession();
          }
          return;
        }

        if (event === "SIGNED_OUT") {
          currentUserId = null;
          if (isSigningOut()) {
            return;
          }
          endCurrentPageSession();
          return;
        }

        if (
          event === "SIGNED_IN" &&
          loginPath &&
          currentUserId &&
          nextUserId &&
          currentUserId !== nextUserId
        ) {
          endCurrentPageSession();
          return;
        }

        if (nextUserId) {
          currentUserId = nextUserId;
        }
      },
    );

    if (loginPath && hasSessionEndedMarker()) {
      endCurrentPageSession();
    }

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("popstate", handlePopState);
      channel?.close();
      data.subscription.unsubscribe();
    };
  }, [currentPathname]);

  return null;
}
