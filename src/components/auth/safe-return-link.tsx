"use client";

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

      if (window.history.length > 1 && isSameOrigin) {
        startTransition(() => navigate(() => router.back()));
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) throw error;

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
        className="pixel-border inline-flex min-h-11 items-center justify-center gap-2 border-2 border-px-indigo bg-px-cream px-4 py-2 text-sm font-semibold text-px-text-dark shadow-[4px_4px_0_var(--px-ink)] hover:bg-px-gold active:bg-px-gold-dk focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-px-indigo disabled:cursor-wait disabled:opacity-70"
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
