"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createClient as createVerifierClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { PixelCard } from "@/components/ui/pixel-primitives";
import { Spinner } from "@/components/ui/spinner";
import { useNavigation } from "@/components/pixel";
import { createClient } from "@/lib/supabase/client";
import { isInvalidSession } from "@/lib/auth/session-errors";
import {
  clearSensitiveFormFields,
  expireSessionAndRedirect,
  SESSION_ENDED_EVENT,
} from "@/lib/auth/session-state";

const MIN_PASSWORD_LENGTH = 8;

type AuthLikeError = { code?: string; message: string };

/**
 * Checks the current password on a throwaway client that never stores a
 * session. Signing in on the dashboard's own client would swap the session
 * (and drop an admin's MFA level), so it is kept completely separate.
 */
async function verifyCurrentPassword(
  email: string,
  password: string,
): Promise<AuthLikeError | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Password change is not configured.");
  }

  const verifier = createVerifierClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { error } = await verifier.auth.signInWithPassword({
    email,
    password,
  });

  if (!error) {
    try {
      // "local" ends only this throwaway session. The default scope would
      // sign the user out everywhere, including this dashboard.
      await verifier.auth.signOut({ scope: "local" });
    } catch {
      // The throwaway session is unused and expires on its own.
    }
  }

  return error;
}

function friendlyVerifyError(error: AuthLikeError): string {
  if (error.code === "invalid_credentials") {
    return "Your current password is incorrect.";
  }

  if (error.code === "over_request_rate_limit") {
    return "Too many attempts. Wait a moment and try again.";
  }

  return error.message;
}

function friendlyUpdateError(error: AuthLikeError): string {
  if (error.code === "same_password") {
    return "Your new password must be different from your current password.";
  }

  if (error.code === "weak_password") {
    return "That password is too weak or has appeared in a known data breach. Choose a stronger one.";
  }

  if (error.code === "reauthentication_needed") {
    return "For security, log out and log back in, then try again.";
  }

  return error.message;
}

export function SettingsPasswordForm({
  sessionExpiredPath,
}: {
  /** Where to send the user if their session has ended. */
  sessionExpiredPath: string;
}) {
  const { beginActivity } = useNavigation();
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    function clearMessages() {
      setErrorMessage("");
      setSuccessMessage("");
      setIsLoading(false);
    }

    window.addEventListener(SESSION_ENDED_EVENT, clearMessages);
    return () =>
      window.removeEventListener(SESSION_ENDED_EVENT, clearMessages);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;
    const form = event.currentTarget;
    setErrorMessage("");
    setSuccessMessage("");

    const formData = new FormData(form);
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (!currentPassword) {
      setErrorMessage("Enter your current password.");
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(
        `Your new password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("The new passwords do not match.");
      return;
    }

    if (newPassword === currentPassword) {
      setErrorMessage(
        "Your new password must be different from your current password.",
      );
      return;
    }

    setIsLoading(true);
    const finishActivity = beginActivity();

    try {
      const supabase = createClient();
      const { data, error: userError } = await supabase.auth.getUser();
      const email = data.user?.email;

      if (userError && !isInvalidSession(userError)) {
        setErrorMessage(userError.message);
        return;
      }

      if (userError || !email) {
        await expireSessionAndRedirect(sessionExpiredPath);
        return;
      }

      const verifyError = await verifyCurrentPassword(email, currentPassword);

      if (verifyError) {
        clearSensitiveFormFields(form);
        setErrorMessage(friendlyVerifyError(verifyError));
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        if (isInvalidSession(updateError)) {
          await expireSessionAndRedirect(sessionExpiredPath);
          return;
        }
        clearSensitiveFormFields(form);
        setErrorMessage(friendlyUpdateError(updateError));
        return;
      }

      clearSensitiveFormFields(form);

      // Sign out every other device; this one stays signed in.
      let othersSignedOut = true;
      try {
        const { error: signOutError } = await supabase.auth.signOut({
          scope: "others",
        });
        othersSignedOut = !signOutError;
      } catch {
        othersSignedOut = false;
      }

      setSuccessMessage(
        othersSignedOut
          ? "Password updated. Other devices have been signed out."
          : "Password updated. We could not sign out your other devices, so log them out manually if needed.",
      );
    } catch (error) {
      clearSensitiveFormFields(form);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update your password.",
      );
    } finally {
      finishActivity();
      setIsLoading(false);
    }
  }

  return (
    <PixelCard className="max-w-2xl">
      <h3 className="text-lg font-semibold text-foreground">
        Change password
      </h3>
      <p className="mt-1 text-sm text-neutral-500">
        Use a password you do not use anywhere else.
      </p>

      <form className="mt-3 space-y-3" autoComplete="off" onSubmit={handleSubmit}>
        <FormField
          label="Current password"
          id="change-password-current"
          name="currentPassword"
          type="password"
          placeholder="Enter your current password"
          autoComplete="current-password"
          required
        />

        <div>
          <FormField
            label="New password"
            id="change-password-new"
            name="newPassword"
            type="password"
            placeholder="Create a new password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
          />
          <p className="mt-1.5 text-xs text-neutral-500">
            At least {MIN_PASSWORD_LENGTH} characters.
          </p>
        </div>

        <FormField
          label="Confirm new password"
          id="change-password-confirm"
          name="confirmPassword"
          type="password"
          placeholder="Confirm your new password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />

        {successMessage ? (
          <p role="status" className="text-sm text-px-grass-text">
            {successMessage}
          </p>
        ) : null}

        {errorMessage ? (
          <p role="alert" className="text-sm text-danger">
            {errorMessage}
          </p>
        ) : null}

        <Button type="submit" aria-busy={isLoading} disabled={isLoading}>
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="h-4 w-4" />
              Updating...
            </span>
          ) : (
            "Update Password"
          )}
        </Button>
      </form>
    </PixelCard>
  );
}
