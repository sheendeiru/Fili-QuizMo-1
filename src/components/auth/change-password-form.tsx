"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { PasswordRequirements, PASSWORD_REQUIREMENTS_ID } from "@/components/ui/password-requirements";
import { useNavigation } from "@/components/pixel";
import { createClient } from "@/lib/supabase/client";
import { isInvalidSession } from "@/lib/auth/session-errors";
import {
  clearSensitiveFormFields,
  expireSessionAndRedirect,
  SESSION_ENDED_EVENT,
} from "@/lib/auth/session-state";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordProblem,
  validatePassword,
} from "@/lib/password-policy";

export function ChangePasswordForm({
  returnTo,
}: {
  returnTo: string | null;
}) {
  const { beginActivity } = useNavigation();
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const sessionEndedRef = useRef(false);

  useEffect(() => {
    function clearRecoveryState() {
      sessionEndedRef.current = true;
      setHasRecoverySession(false);
      setErrorMessage("");
      setStatusMessage("");
      setIsSubmitting(false);
      setPassword("");
      setConfirmPassword("");
    }

    window.addEventListener(SESSION_ENDED_EVENT, clearRecoveryState);
    return () =>
      window.removeEventListener(SESSION_ENDED_EVENT, clearRecoveryState);
  }, []);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.getSession();

        if (!active || sessionEndedRef.current) {
          return;
        }

        if (error) {
          if (isInvalidSession(error)) {
            await expireSessionAndRedirect();
            setHasRecoverySession(false);
            setErrorMessage("Your password reset session expired.");
            return;
          }
          setErrorMessage(error.message);
        } else {
          setHasRecoverySession(Boolean(data.session));
          setAccountEmail(data.session?.user.email ?? "");
        }
      } catch (error) {
        if (active) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to check the password reset session.",
          );
        }
      } finally {
        if (active) {
          setIsCheckingSession(false);
        }
      }
    }

    void checkSession();
    return () => {
      active = false;
    };
  }, []);

  async function handleResetRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const finishActivity = beginActivity();
    setErrorMessage("");
    setStatusMessage("");
    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      const email = String(formData.get("email") ?? "").trim();
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: new URL(
          `/change-password${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`,
          window.location.origin,
        ).toString(),
      });

      if (sessionEndedRef.current) {
        return;
      }

      if (error) {
        if (isInvalidSession(error)) {
          await expireSessionAndRedirect();
          setHasRecoverySession(false);
          setErrorMessage("Your password reset session expired.");
          return;
        }
        setErrorMessage(error.message);
        return;
      }

      setStatusMessage(
        "If an account exists for that email, a password reset link is on its way.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to request a password reset.",
      );
    } finally {
      finishActivity();
      setIsSubmitting(false);
    }
  }

  async function handlePasswordUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const finishActivity = beginActivity();
    const form = event.currentTarget;
    setErrorMessage("");
    setStatusMessage("");
    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      const password = String(formData.get("password") ?? "");
      const confirmPassword = String(formData.get("confirmPassword") ?? "");

      if (password !== confirmPassword) {
        clearSensitiveFormFields(form);
        setPassword("");
        setConfirmPassword("");
        setErrorMessage("The passwords do not match.");
        return;
      }

      const check = validatePassword(password, [accountEmail]);
      if (!check.valid) {
        setErrorMessage(passwordProblem(check));
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (sessionEndedRef.current) {
        return;
      }

      if (error) {
        if (isInvalidSession(error)) {
          await expireSessionAndRedirect();
          setHasRecoverySession(false);
          setErrorMessage("Your password reset session expired.");
          return;
        }
        clearSensitiveFormFields(form);
        setPassword("");
        setConfirmPassword("");
        setErrorMessage(error.message);
        return;
      }

      setStatusMessage("Your password has been updated. You can now sign in.");
      form.reset();
      setPassword("");
      setConfirmPassword("");
      setHasRecoverySession(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to update password.",
      );
    } finally {
      finishActivity();
      setIsSubmitting(false);
    }
  }

  if (isCheckingSession) {
    return <p role="status">Checking your password reset session...</p>;
  }

  return (
    <div className="space-y-5">
      {errorMessage ? (
        <p role="alert" className="text-sm text-danger">
          {errorMessage}
        </p>
      ) : null}
      {statusMessage ? (
        <p role="status" className="text-sm text-px-grass-text">
          {statusMessage}
        </p>
      ) : null}
      {hasRecoverySession ? (
        <form className="space-y-3" onSubmit={handlePasswordUpdate}>
          <div>
            <FormField
              label="New password"
              id="new-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              aria-describedby={PASSWORD_REQUIREMENTS_ID}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <PasswordRequirements
              password={password}
              confirmPassword={confirmPassword}
              email={accountEmail}
              context="reset"
              className="mt-1"
            />
          </div>
          <FormField
            label="Confirm new password"
            id="confirm-new-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            Update Password
          </Button>
        </form>
      ) : (
        <form className="space-y-5" onSubmit={handleResetRequest}>
          <p className="text-sm text-neutral-500">
            Enter your account email and we&apos;ll send you a secure password
            reset link.
          </p>
          <FormField
            label="Email address"
            id="reset-email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Send Reset Link"}
          </Button>
        </form>
      )}
    </div>
  );
}
