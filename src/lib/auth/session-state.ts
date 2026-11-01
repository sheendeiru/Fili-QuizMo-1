"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

export const SESSION_ENDED_EVENT = "fili-quizmo:session-ended";
export const SESSION_ENDED_STORAGE_KEY = "fili-quizmo-session-ended";
export const SESSION_EPOCH_STORAGE_KEY = "fili-quizmo-session-epoch";
const SESSION_CHANNEL_NAME = "fili-quizmo-session";
const SESSION_STORAGE_PING = "fili-quizmo-session-reset";

type SessionResetOptions = {
  broadcast?: boolean;
  redirect?: boolean;
  redirectTo?: string;
};

const activeRequests = new Set<AbortController>();
let cleanupTask: Promise<void> | null = null;
let signingOut = false;

export function createSessionRequestController(): AbortController {
  const controller = new AbortController();
  activeRequests.add(controller);
  controller.signal.addEventListener(
    "abort",
    () => activeRequests.delete(controller),
    { once: true },
  );
  return controller;
}

export function releaseSessionRequestController(
  controller: AbortController,
): void {
  activeRequests.delete(controller);
}

export function clearSensitiveFormFields(
  form: HTMLFormElement | null,
): void {
  if (!form) {
    return;
  }

  form
    .querySelectorAll<HTMLInputElement>(
      'input[type="password"], input[autocomplete="one-time-code"]',
    )
    .forEach((input) => {
      input.value = "";
    });
}

export function clearSessionEndedMarker(): void {
  try {
    window.sessionStorage.removeItem(SESSION_ENDED_STORAGE_KEY);
  } catch {
    console.error("Could not clear the session-ended marker.");
  }
}

export function hasSessionEndedMarker(): boolean {
  try {
    return window.sessionStorage.getItem(SESSION_ENDED_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function isSigningOut(): boolean {
  return signingOut;
}

export function getSessionEpoch(): number {
  try {
    const epoch = Number(
      window.sessionStorage.getItem(SESSION_EPOCH_STORAGE_KEY) ?? "0",
    );
    return Number.isSafeInteger(epoch) && epoch >= 0 ? epoch : 0;
  } catch {
    console.error("Could not read the session boundary marker.");
    return 0;
  }
}

function clearFormState(): void {
  document.querySelectorAll<HTMLFormElement>("form").forEach((form) => {
    form.reset();
  });

  document
    .querySelectorAll<HTMLInputElement>("input")
    .forEach((input) => {
      if (input.type === "checkbox" || input.type === "radio") {
        input.checked = false;
      }

      if (input.type === "file" || input.type !== "submit") {
        input.value = "";
      }
    });

  document
    .querySelectorAll<HTMLTextAreaElement>("textarea")
    .forEach((textarea) => {
      textarea.value = "";
    });

  document
    .querySelectorAll<HTMLSelectElement>("select")
    .forEach((select) => {
      select.selectedIndex = -1;
    });
}

function signalOtherTabs(): void {
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(SESSION_CHANNEL_NAME);
      channel.postMessage({ type: "SESSION_ENDED" });
      channel.close();
    }
  } catch {
    console.error("Could not notify other tabs through BroadcastChannel.");
  }

  try {
    window.localStorage.setItem(SESSION_STORAGE_PING, String(Date.now()));
    window.setTimeout(() => {
      try {
        window.localStorage.removeItem(SESSION_STORAGE_PING);
      } catch {
        console.error("Could not clear the cross-tab session signal.");
      }
    }, 0);
  } catch {
    console.error("Could not notify other tabs that the session ended.");
  }
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB deletion failed."));
    request.onblocked = () =>
      reject(new Error("IndexedDB deletion was blocked."));
  });
}

async function clearBrowserStores(): Promise<void> {
  const failures: string[] = [];
  const nextSessionEpoch = getSessionEpoch() + 1;

  try {
    window.localStorage.clear();
  } catch {
    failures.push("localStorage");
  }

  try {
    window.sessionStorage.clear();
    window.sessionStorage.setItem(
      SESSION_ENDED_STORAGE_KEY,
      String(Date.now()),
    );
    window.sessionStorage.setItem(
      SESSION_EPOCH_STORAGE_KEY,
      String(nextSessionEpoch),
    );
  } catch {
    failures.push("sessionStorage");
  }

  if ("caches" in window) {
    try {
      const cacheNames = await window.caches.keys();
      const deleted = await Promise.all(
        cacheNames.map((name) => window.caches.delete(name)),
      );
      if (deleted.some((result) => !result)) {
        failures.push("Cache Storage");
      }
    } catch {
      failures.push("Cache Storage");
    }
  }

  if ("indexedDB" in window && "databases" in window.indexedDB) {
    try {
      const databases = await window.indexedDB.databases();
      await Promise.all(
        databases.flatMap((database) =>
          database.name ? [deleteDatabase(database.name)] : [],
        ),
      );
    } catch {
      failures.push("IndexedDB");
    }
  }

  if (failures.length > 0) {
    console.error(
      "Session cleanup could not clear every browser storage location.",
      failures,
    );
  }
}

function inferLoginPath(pathname: string): string | undefined {
  if (pathname === "/admin-dashboard" || pathname.startsWith("/admin-dashboard/")) {
    return "/admin-login?status=session_expired";
  }

  if (
    pathname === "/teacher-dashboard" ||
    pathname.startsWith("/teacher-dashboard/")
  ) {
    return "/teacher-login?status=session_expired";
  }

  if (
    pathname === "/student-dashboard" ||
    pathname.startsWith("/student-dashboard/")
  ) {
    return "/student-login?status=session_expired";
  }

  if (pathname === "/complete-profile") {
    return "/signup?status=session_expired";
  }

  return undefined;
}

export async function resetSessionState(
  options: SessionResetOptions = {},
): Promise<void> {
  const { broadcast = false, redirect = true, redirectTo } = options;

  if (broadcast) {
    signalOtherTabs();
  }

  if (!cleanupTask) {
    cleanupTask = (async () => {
      window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
      activeRequests.forEach((controller) => controller.abort());
      activeRequests.clear();
      clearFormState();
      await clearBrowserStores();
    })().finally(() => {
      cleanupTask = null;
    });
  }

  await cleanupTask;

  const destination = redirect
    ? (redirectTo ?? inferLoginPath(window.location.pathname))
    : undefined;
  if (destination) {
    window.location.replace(destination);
  }
}

export async function signOutAndReset(
  client: SupabaseClient,
  options: SessionResetOptions & {
    scope?: "global" | "local";
  } = {},
): Promise<boolean> {
  let serverSignOutConfirmed = true;
  let localSessionCleared = true;

  signingOut = true;
  try {
    try {
      const { error } = await client.auth.signOut({
        scope: options.scope ?? "global",
      });
      serverSignOutConfirmed = !error;
    } catch {
      serverSignOutConfirmed = false;
    }

    if (!serverSignOutConfirmed) {
      try {
        const { error } = await client.auth.signOut({ scope: "local" });
        localSessionCleared = !error;
      } catch {
        localSessionCleared = false;
      }

      if (!localSessionCleared) {
        console.error("Could not clear the local authentication session.");
      }
    }

    await resetSessionState({
      broadcast: options.broadcast ?? true,
      redirect: options.redirect,
    });

    if (options.redirect !== false && options.redirectTo) {
      const destination = new URL(options.redirectTo, window.location.origin);
      if (!serverSignOutConfirmed) {
        destination.searchParams.set("status", "logout_unverified");
      }
      window.location.replace(
        `${destination.pathname}${destination.search}${destination.hash}`,
      );
    }

    return serverSignOutConfirmed && localSessionCleared;
  } finally {
    signingOut = false;
  }
}

export async function expireSessionAndRedirect(
  loginPath?: string,
): Promise<void> {
  const { createClient } = await import("@/lib/supabase/client");
  await signOutAndReset(createClient(), {
    scope: "local",
    broadcast: true,
    redirectTo: loginPath,
  });
}

export function sessionLoginPath(pathname: string): string | undefined {
  return inferLoginPath(pathname);
}
