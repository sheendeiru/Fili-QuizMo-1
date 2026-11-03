"use client";

import { useRouter } from "next/navigation";
import { useNavigation } from "@/components/pixel";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Spinner } from "@/components/ui/spinner";
import { PolicyConsent } from "@/components/auth/policy-consent";
import {
  USERNAME_REQUIREMENTS,
  isValidUsername,
} from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";
import {
  clearSensitiveFormFields,
  clearSessionEndedMarker,
  createSessionRequestController,
  expireSessionAndRedirect,
  releaseSessionRequestController,
  SESSION_ENDED_EVENT,
} from "@/lib/auth/session-state";
import { POLICY_VERSION } from "@/lib/legal/policy-version";

type SignupRole = "student" | "teacher";

type ProfileResponse = {
  destination?: string;
  error?: {
    code?: string;
    message?: string;
  };
};

function friendlySignupError(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("already registered") ||
    normalized.includes("already exists")
  ) {
    return "An account with this email already exists. Sign in or reset your password.";
  }

  if (normalized.includes("rate limit")) {
    return "Too many signup attempts. Wait a moment and try again.";
  }

  return message;
}

export function SignupForm() {
  const router = useRouter();
  const { navigate, beginActivity } = useNavigation();
  const [role, setRole] = useState<SignupRole>("student");
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);

  useEffect(() => {
    function clearSignupState() {
      setRole("student");
      setErrorMessage("");
      setStatusMessage("");
      setIsLoading(false);
    }

    window.addEventListener(SESSION_ENDED_EVENT, clearSignupState);
    return () =>
      window.removeEventListener(SESSION_ENDED_EVENT, clearSignupState);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading || !consentAccepted) return;
    const form = event.currentTarget;
    setErrorMessage("");
    setStatusMessage("");

    const formData = new FormData(form);
    const username = String(formData.get("username") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(
      formData.get("confirmPassword") ?? "",
    );

    if (!isValidUsername(username)) {
      setErrorMessage(USERNAME_REQUIREMENTS);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("The passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    setIsLoading(true);
    const finishActivity = beginActivity();
    const controller = createSessionRequestController();
    const consentAcceptedAt = new Date().toISOString();

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            account_role: role,
            username,
            consent_accepted_at: consentAcceptedAt,
            consent_policy_version: POLICY_VERSION,
          },
          emailRedirectTo: new URL(
            "/auth/confirm",
            window.location.origin,
          ).toString(),
        },
      });

      if (controller.signal.aborted) {
        return;
      }

      if (error) {
        clearSensitiveFormFields(form);
        setErrorMessage(friendlySignupError(error.message));
        return;
      }

      if (!data.session) {
        clearSensitiveFormFields(form);
        setStatusMessage(
          role === "teacher"
            ? "Check your email to confirm your account. Your teacher account stays pending until an administrator approves it."
            : "Check your email to confirm your account. After confirming, sign in to view your dashboard.",
        );
        return;
      }

      clearSensitiveFormFields(form);
      clearSessionEndedMarker();
      const profileResponse = await fetch("/api/auth/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, username }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) {
        return;
      }
      const profileResult =
        (await profileResponse.json()) as ProfileResponse;

      if (profileResponse.status === 401) {
        await expireSessionAndRedirect("/signup?status=session_expired");
        return;
      }

      if (profileResponse.ok && profileResult.destination) {
        const destination = profileResult.destination;
        navigate(() => {
          router.replace(destination);
          router.refresh();
        });
        return;
      }

      if (profileResponse.status === 409) {
        navigate(() => {
          router.replace("/complete-profile?reason=username_taken");
          router.refresh();
        });
        return;
      }

      navigate(() => {
        router.replace("/complete-profile?reason=profile_error");
        router.refresh();
      });
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      clearSensitiveFormFields(form);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to create your account.",
      );
    } finally {
      finishActivity();
      releaseSessionRequestController(controller);
      setIsLoading(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div>
        <p className="text-sm font-medium text-foreground">Account type</p>
        <div
          role="group"
          aria-label="Account type"
          className="mt-2 grid grid-cols-2 gap-2"
        >
          <Button
            type="button"
            variant={role === "student" ? "primary" : "outline"}
            aria-pressed={role === "student"}
            onClick={() => setRole("student")}
          >
            Student
          </Button>
          <Button
            type="button"
            variant={role === "teacher" ? "accent" : "outline"}
            aria-pressed={role === "teacher"}
            onClick={() => setRole("teacher")}
          >
            Teacher
          </Button>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          {role === "student"
            ? "Student accounts can track quiz history and scores."
            : "Teacher accounts are created as pending and need administrator approval before sign-in."}
        </p>
      </div>

      <div>
        <FormField
          label="Username"
          id="signup-username"
          name="username"
          type="text"
          placeholder="e.g. juan_dela_cruz"
          autoComplete="username"
          spellCheck={false}
          minLength={3}
          maxLength={15}
          pattern="[A-Za-z][A-Za-z0-9_]{2,14}"
          required
        />
        <p className="mt-1.5 text-xs text-neutral-500">
          {USERNAME_REQUIREMENTS}
        </p>
      </div>

      <FormField
        label="Email address"
        id="signup-email"
        name="email"
        type="email"
        placeholder="you@example.com"
        autoComplete="email"
        required
      />

      <FormField
        label="Password"
        id="signup-password"
        name="password"
        type="password"
        placeholder="Create a password"
        autoComplete="new-password"
        minLength={8}
        required
      />

      <FormField
        label="Confirm password"
        id="signup-confirm-password"
        name="confirmPassword"
        type="password"
        placeholder="Confirm your password"
        autoComplete="new-password"
        minLength={8}
        required
      />

      <PolicyConsent
        id="signup-consent"
        checked={consentAccepted}
        onChange={setConsentAccepted}
      />

      {statusMessage ? (
        <p role="status" className="text-sm text-px-grass-text">
          {statusMessage}
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
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <Spinner className="h-4 w-4" />
            Creating account...
          </span>
        ) : (
          "Create Account"
        )}
      </Button>
    </form>
  );
}
