"use client";

import { useRouter } from "next/navigation";
import { useNavigation } from "@/components/pixel";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { NavLink } from "@/components/pixel";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Spinner } from "@/components/ui/spinner";
import { PolicyConsent } from "@/components/auth/policy-consent";
import {
  createAccountRoleLookup,
  resolveAccountAccess,
} from "@/lib/auth/roles";
import { friendlyLoginError } from "@/lib/auth/error-messages";
import { createClient } from "@/lib/supabase/client";
import {
  clearSensitiveFormFields,
  clearSessionEndedMarker,
  SESSION_ENDED_EVENT,
  signOutAndReset,
} from "@/lib/auth/session-state";

function initialErrorMessage(status?: string): string {
  if (status === "pending") {
    return "Your teacher account is pending administrator approval.";
  }

  if (status === "blocked") {
    return "Your teacher account is not active. Contact an administrator.";
  }

  if (status === "session_expired") {
    return "Your session expired. Sign in again to continue.";
  }

  if (status === "unavailable") {
    return "We could not verify your account access. Please try again.";
  }

  if (status === "logout_unverified") {
    return "Your browser session was cleared, but server sign-out could not be confirmed.";
  }

  return "";
}

export function TeacherLoginForm({ status }: { status?: string }) {
  const router = useRouter();
  const { navigate, beginActivity } = useNavigation();
  const pathname = usePathname();
  const [errorMessage, setErrorMessage] = useState(
    initialErrorMessage(status),
  );
  const [noticeMessage, setNoticeMessage] = useState(
    status === "confirmed"
      ? "Email confirmed. Sign in to continue."
      : "",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);

  useEffect(() => {
    function clearMessages() {
      setErrorMessage("");
      setNoticeMessage("");
      setIsLoading(false);
    }

    window.addEventListener(SESSION_ENDED_EVENT, clearMessages);
    return () =>
      window.removeEventListener(SESSION_ENDED_EVENT, clearMessages);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;
    if (!consentAccepted) return;
    const finishActivity = beginActivity();
    const form = event.currentTarget;
    setErrorMessage("");
    setNoticeMessage("");
    setIsLoading(true);
    let sessionEstablished = false;

    try {
      const formData = new FormData(form);
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: String(formData.get("email") ?? "").trim(),
        password: String(formData.get("password") ?? ""),
      });

      if (signInError) {
        clearSensitiveFormFields(form);
        setErrorMessage(friendlyLoginError(signInError.message));
        return;
      }

      sessionEstablished = true;
      clearSessionEndedMarker();
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData.user) {
        await signOutAndReset(supabase);
        sessionEstablished = false;
        setErrorMessage(
          userError?.message ?? "Unable to fetch teacher account.",
        );
        return;
      }

      const access = await resolveAccountAccess(
        createAccountRoleLookup(supabase),
        userData.user,
      );

      if (access.state === "unregistered") {
        clearSensitiveFormFields(form);
        navigate(() => {
          router.replace("/complete-profile");
          router.refresh();
        });
        return;
      }

      if (access.role === "teacher" && access.state === "active") {
        clearSensitiveFormFields(form);
        navigate(() => {
          router.replace("/teacher-dashboard");
          router.refresh();
        });
        return;
      }

      const signOutConfirmed = await signOutAndReset(supabase);
      sessionEstablished = false;
      const signOutNote = signOutConfirmed
        ? ""
        : " Your local session was cleared, but server sign-out could not be confirmed.";

      if (access.role === "teacher" && access.state === "pending") {
        setErrorMessage(`Your teacher account is pending administrator approval.${signOutNote}`);
        return;
      }

      if (access.role === "teacher" && access.state === "blocked") {
        setErrorMessage(`Your teacher account is not active. Contact an administrator.${signOutNote}`);
        return;
      }

      if (access.role === "admin") {
        setErrorMessage(`This is an administrator account. Use the admin login page.${signOutNote}`);
        return;
      }

      if (access.role === "student") {
        setErrorMessage(`This is a student account. Use the student login page.${signOutNote}`);
        return;
      }

      setErrorMessage(`This account is not authorized for teacher access.${signOutNote}`);
    } catch (error) {
      if (sessionEstablished) {
        await signOutAndReset(createClient());
      } else {
        clearSensitiveFormFields(form);
      }
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to sign in securely.",
      );
    } finally {
      finishActivity();
      setIsLoading(false);
    }
  }

  return (
    <form className="space-y-5" autoComplete="off" onSubmit={handleSubmit}>
      <FormField
        label="Email address"
        id="teacher-email"
        name="email"
        type="email"
        placeholder="teacher@example.com"
        autoComplete="email"
        required
      />
      <FormField
        label="Password"
        id="teacher-password"
        name="password"
        type="password"
        placeholder="Enter your password"
        autoComplete="current-password"
        required
      />
      <PolicyConsent
        id="teacher-login-consent"
        checked={consentAccepted}
        onChange={setConsentAccepted}
      />
      <div className="-mt-2 text-right">
        <NavLink
          href={`/change-password?returnTo=${encodeURIComponent(pathname)}`}
          className="text-xs font-semibold text-px-gold-text hover:underline focus-visible:outline"
        >
          Forgot password?
        </NavLink>
      </div>
      {noticeMessage ? (
        <p role="status" className="text-sm text-px-grass-text">
          {noticeMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p role="alert" className="text-sm text-danger">
          {errorMessage}
        </p>
      ) : null}
      <Button
        type="submit"
        className="w-full"
        disabled={isLoading || !consentAccepted}
        aria-busy={isLoading}
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <Spinner className="h-4 w-4" />
            Signing in...
          </span>
        ) : (
          "Sign In as Teacher"
        )}
      </Button>
    </form>
  );
}
