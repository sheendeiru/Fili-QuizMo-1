"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Spinner } from "@/components/ui/spinner";
import {
  USERNAME_REQUIREMENTS,
  isValidUsername,
} from "@/lib/auth/roles";
import {
  createSessionRequestController,
  expireSessionAndRedirect,
  releaseSessionRequestController,
  SESSION_ENDED_EVENT,
} from "@/lib/auth/session-state";

type CompleteProfileRole = "student" | "teacher";

type ProfileResponse = {
  destination?: string;
  error?: {
    code?: string;
    message?: string;
  };
};

export function CompleteProfileForm({
  email,
  initialRole,
  initialUsername,
  roleLocked,
  initialError = "",
}: {
  email: string | null;
  initialRole: CompleteProfileRole;
  initialUsername: string;
  roleLocked: boolean;
  initialError?: string;
}) {
  const router = useRouter();
  const [role, setRole] =
    useState<CompleteProfileRole>(initialRole);
  const [errorMessage, setErrorMessage] = useState(initialError);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    function clearProfileState() {
      setRole(initialRole);
      setErrorMessage("");
      setIsLoading(false);
    }

    window.addEventListener(SESSION_ENDED_EVENT, clearProfileState);
    return () =>
      window.removeEventListener(SESSION_ENDED_EVENT, clearProfileState);
  }, [initialRole]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") ?? "").trim();

    if (!isValidUsername(username)) {
      setErrorMessage(USERNAME_REQUIREMENTS);
      return;
    }

    setIsLoading(true);
    const controller = createSessionRequestController();

    try {
      const response = await fetch("/api/auth/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, username }),
        signal: controller.signal,
      });
      const result = (await response.json()) as ProfileResponse;

      if (response.status === 401) {
        await expireSessionAndRedirect("/signup?status=session_expired");
        return;
      }

      if (response.ok && result.destination) {
        router.replace(result.destination);
        router.refresh();
        return;
      }

      setErrorMessage(
        result.error?.message ??
          "Your profile could not be set up. Please try again.",
      );
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Your profile could not be set up. Please try again.",
      );
    } finally {
      releaseSessionRequestController(controller);
      setIsLoading(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {email ? (
        <p className="text-sm text-neutral-500">
          Signed in as <strong className="text-foreground">{email}</strong>
        </p>
      ) : null}

      {roleLocked ? (
        <p className="text-sm text-neutral-600">
          Account type:{" "}
          <strong className="text-foreground">
            {role === "teacher" ? "Teacher" : "Student"}
          </strong>
        </p>
      ) : (
        <div>
          <p className="text-sm font-medium text-foreground">
            Account type
          </p>
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
              variant={role === "teacher" ? "primary" : "outline"}
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
      )}

      <div>
        <FormField
          label="Username"
          id="complete-profile-username"
          name="username"
          type="text"
          defaultValue={initialUsername}
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

      {errorMessage ? (
        <p role="alert" className="text-sm text-danger">
          {errorMessage}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <Spinner className="h-4 w-4" />
            Finishing setup...
          </span>
        ) : (
          "Finish Setup"
        )}
      </Button>
    </form>
  );
}
