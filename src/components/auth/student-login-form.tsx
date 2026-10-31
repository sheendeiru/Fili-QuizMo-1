"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";

export function StudentLoginForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setErrorMessage("");
    setIsLoading(true);

    try {
      const formData = new FormData(event.currentTarget);
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: String(formData.get("email") ?? "").trim(),
        password: String(formData.get("password") ?? ""),
      });

      if (signInError) {
        setErrorMessage("Invalid email or password.");
        return;
      }

      form.reset();
      router.replace("/");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to sign in securely.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <FormField
        label="Email address"
        id="student-email"
        name="email"
        type="email"
        placeholder="student@example.com"
        autoComplete="email"
        required
      />
      <FormField
        label="Password"
        id="student-password"
        name="password"
        type="password"
        placeholder="Enter your password"
        autoComplete="current-password"
        required
      />
      <div className="-mt-2 text-right">
        <Link
          href="/change-password"
          className="text-xs font-semibold text-secondary hover:underline focus-visible:outline"
        >
          Forgot password?
        </Link>
      </div>
      {errorMessage ? (
        <p role="alert" className="text-sm text-red-600">
          {errorMessage}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <Spinner className="h-4 w-4" />
            Signing in...
          </span>
        ) : (
          "Sign In as Student"
        )}
      </Button>
    </form>
  );
}
