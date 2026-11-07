"use client";

import { IN_APP_NAV_KEY } from "@/components/layout/nav-tracker";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useNavigation } from "@/components/pixel";
import { createAccountRoleLookup, resolveAccountAccess } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";
import { safeInternalPath } from "@/lib/safe-redirect";


const loginPaths = new Set([
  "/login",
  "/admin-login",
  "/student-login",
  "/teacher-login",
]);

export function SafeReturnLink({
  returnTo,
}: {
  returnTo: string | null;
}) {
  const router = useRouter();
  const { beginActivity, navigate } = useNavigation();
  const [isResolving, setIsResolving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState("");
  const destination = safeInternalPath(returnTo);
  const label =
    destination && loginPaths.has(destination) ? "Back to login" : "Back";
  const isBusy = isResolving || isPending;
  const hasReturnTo = returnTo !== null && returnTo !== "";

  async function handleClick() {
    if (isBusy) return;

    setErrorMessage("");
    setIsResolving(true);
    const finishActivity = beginActivity();

    try {
      if (destination) {
        startTransition(() => navigate(() => router.push(destination)));
        return;
      }

      const previousUrl = hasReturnTo ? "" : document.referrer;
      let isSameOrigin = false;
      if (previousUrl) {
        try {
          isSameOrigin =
            new URL(previousUrl).origin === window.location.origin;
        } catch {
          isSameOrigin = false;
        }
      }

      let hasInAppHistory = false;
      try {
        hasInAppHistory = sessionStorage.getItem(IN_APP_NAV_KEY) === "1";
      } catch {
        hasInAppHistory = false;
      }

      if (window.history.length > 1 && (isSameOrigin || hasInAppHistory)) {
        startTransition(() => navigate(() => router.back()));
        return;
      }

      if (
        !hasReturnTo &&
        new URLSearchParams(window.location.search).get("src") === "consent"
      ) {
        window.close();
        await new Promise((resolve) => setTimeout(resolve, 150));
      }


      const supabase = createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      const sessionMissing = 
        error?.name === "AuthSessionMissingError" ||
        error?.message === "Auth session missing!";
      if (error && !sessionMissing) throw error;

      let fallback = "/login";
      if (user) {
        const access = await resolveAccountAccess(
          createAccountRoleLookup(supabase),
          user,
        );

        fallback =
          access.state === "unregistered"
            ? "/complete-profile"
            : access.state === "active" && access.role
              ? `/${access.role}-dashboard`
              : access.role
                ? `/${access.role}-login`
                : "/login";
      }

      startTransition(() => navigate(() => router.push(fallback)));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to return to the previous page.",
      );
    } finally {
      finishActivity();
      setIsResolving(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isBusy}
        aria-disabled={isBusy}
        aria-busy={isBusy}
        // Same pixel-button base as "Send Reset Link": identical 2px navy border,
        // pixel shadow and press animation. Gold text, white while pressed.
        className="pixel-button inline-flex h-10 items-center justify-center gap-2 px-4 text-sm font-semibold text-accent! active:text-white! [--pixel-button-bg:var(--color-ink)]"
      >
        {isBusy ? <Spinner className="h-4 w-4" /> : null}
        {isBusy ? "Loading..." : label}
      </button>
      {errorMessage ? (
        <span role="alert" className="text-sm text-px-coral-text">
          {errorMessage}
        </span>
      ) : null}
    </span>
  );
}