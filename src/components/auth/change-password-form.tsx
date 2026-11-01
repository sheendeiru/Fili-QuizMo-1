"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { createClient } from "@/lib/supabase/client";
import { isInvalidSession } from "@/lib/auth/session-errors";
import {
  clearSensitiveFormFields,
  expireSessionAndRedirect,
  SESSION_ENDED_EVENT,
} from "@/lib/auth/session-state";

export function ChangePasswordForm() {
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const sessionEndedRef = useRef(false);

  useEffect(() => {
    function clearRecoveryState() {
      sessionEndedRef.current = true;
      setHasRecoverySession(false);
      setErrorMessage("");
      setStatusMessage("");
      setIsSubmitting(false);
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
    setErrorMessage("");
    setStatusMessage("");
    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      const email = String(formData.get("email") ?? "").trim();
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: new URL("/change-password", window.location.origin).toString(),
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
      setIsSubmitting(false);
    }
  }

  async function handlePasswordUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
        setErrorMessage("The passwords do not match.");
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
        setErrorMessage(error.message);
        return;
      }

      setStatusMessage("Your password has been updated. You can now sign in.");
      form.reset();
      setHasRecoverySession(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to update password.",
      );
    } finally {
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
        <p role="status" className="text-sm text-success">
          {statusMessage}
        </p>
      ) : null}
      {hasRecoverySession ? (
        <form className="space-y-5" onSubmit={handlePasswordUpdate}>
          <FormField
            label="New password"
            id="new-password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <FormField
            label="Confirm new password"
            id="confirm-new-password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
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
