"use client";

import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useNavigation } from "@/components/pixel";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
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
import Image from "next/image";

function initialErrorMessage(status?: string): string {
  if (status === "blocked") {
    return "This account is not authorized for admin access.";
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

export function AdminLoginForm({
  status,
  mfaRequired = false,
}: {
  status?: string;
  mfaRequired?: boolean;
}) {
  const router = useRouter();
  const { navigate, beginActivity } = useNavigation();
  const pathname = usePathname();
  const [step, setStep] = useState<"credentials" | "enroll" | "verify">(
    "credentials",
  );
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [errorMessage, setErrorMessage] = useState(
    initialErrorMessage(status),
  );
  const [noticeMessage, setNoticeMessage] = useState(
    mfaRequired
      ? "Complete multi-factor authentication to access the admin dashboard."
      : "",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);

  useEffect(() => {
    function clearMfaState() {
      setStep("credentials");
      setFactorId("");
      setQrCode("");
      setSecret("");
      setErrorMessage("");
      setNoticeMessage("");
      setIsLoading(false);
    }

    window.addEventListener(SESSION_ENDED_EVENT, clearMfaState);
    return () =>
      window.removeEventListener(SESSION_ENDED_EVENT, clearMfaState);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;
    if (step === "credentials" && !consentAccepted) return;
    const finishActivity = beginActivity();
    const form = event.currentTarget;
    setErrorMessage("");
    setNoticeMessage("");
    setIsLoading(true);
    let sessionEstablished = false;
    let supabase: ReturnType<typeof createClient> | null = null;

    try {
      supabase = createClient();
      const formData = new FormData(form);

      if (step === "credentials") {
        const { error: signInError } =
          await supabase.auth.signInWithPassword({
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
            userError?.message ?? "Unable to fetch admin account.",
          );
          return;
        }

        const access = await resolveAccountAccess(
          createAccountRoleLookup(supabase),
          userData.user,
        );

        if (access.role !== "admin" || access.state !== "active") {
          const signOutConfirmed = await signOutAndReset(supabase);
          sessionEstablished = false;
          setErrorMessage(
            signOutConfirmed
              ? "This account is not authorized for admin access."
              : "This account is not authorized for admin access. Your local session was cleared, but server sign-out could not be confirmed.",
          );
          return;
        }

        const { data: assurance, error: assuranceError } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        if (assuranceError) {
          await signOutAndReset(supabase);
          sessionEstablished = false;
          setErrorMessage(assuranceError.message);
          return;
        }

        if (assurance.currentLevel === "aal2") {
          clearSensitiveFormFields(form);
          navigate(() => {
            router.replace("/admin-dashboard");
            router.refresh();
          });
          return;
        }

        const { data: factors, error: factorsError } =
          await supabase.auth.mfa.listFactors();

        if (factorsError) {
          await signOutAndReset(supabase);
          sessionEstablished = false;
          setErrorMessage(factorsError.message);
          return;
        }

        const verifiedFactor = factors.totp.find(
          (factor) => factor.status === "verified",
        );

        if (verifiedFactor) {
          clearSensitiveFormFields(form);
          setFactorId(verifiedFactor.id);
          setStep("verify");
          return;
        }

        for (const factor of factors.all) {
          if (
            factor.factor_type === "totp" &&
            factor.status === "unverified"
          ) {
            const { error: unenrollError } =
              await supabase.auth.mfa.unenroll({ factorId: factor.id });

            if (unenrollError) {
              await signOutAndReset(supabase);
              sessionEstablished = false;
              setErrorMessage(unenrollError.message);
              return;
            }
          }
        }

        const { data: enrollment, error: enrollmentError } =
          await supabase.auth.mfa.enroll({
            factorType: "totp",
            friendlyName: "Admin authenticator",
          });

        if (enrollmentError) {
          await signOutAndReset(supabase);
          sessionEstablished = false;
          setErrorMessage(enrollmentError.message);
          return;
        }

        setFactorId(enrollment.id);
        setQrCode(enrollment.totp.qr_code);
        setSecret(enrollment.totp.secret);
        clearSensitiveFormFields(form);
        setStep("enroll");
        return;
      }

      const code = String(formData.get("code") ?? "").trim();
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });

      if (challengeError) {
        clearSensitiveFormFields(form);
        setErrorMessage(challengeError.message);
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });

      if (verifyError) {
        clearSensitiveFormFields(form);
        setErrorMessage(verifyError.message);
        return;
      }

      const { data: assurance, error: assuranceError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (assuranceError) {
        await signOutAndReset(supabase);
        sessionEstablished = false;
        clearSensitiveFormFields(form);
        setErrorMessage(assuranceError.message);
        return;
      }

      if (assurance.currentLevel !== "aal2") {
        await signOutAndReset(supabase);
        sessionEstablished = false;
        clearSensitiveFormFields(form);
        setErrorMessage(
          "MFA verification did not establish the required admin session. Try again.",
        );
        return;
      }

      clearSensitiveFormFields(form);
      navigate(() => {
        router.replace("/admin-dashboard");
        router.refresh();
      });
    } catch (error) {
      if (sessionEstablished && supabase) {
        await signOutAndReset(supabase);
      }
      clearSensitiveFormFields(form);
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
      {step === "credentials" ? (
        <>
          <FormField
            label="Admin email"
            id="admin-email"
            name="email"
            type="email"
            placeholder="admin@example.com"
            autoComplete="username"
            required
          />
          <FormField
            label="Password"
            id="admin-password"
            name="password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />
          <PolicyConsent
            id="admin-login-consent"
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
        </>
      ) : (
        <>
          {step === "enroll" ? (
            <div className="space-y-3 text-sm text-neutral-600">
              <p>
                Scan this QR code with an authenticator app, then enter its
                current six-digit code.
              </p>
              <Image
                src={qrCode}
                alt="QR code for admin authenticator setup"
                width={192}
                height={192}
                unoptimized
                className="mx-auto h-48 w-48"
              />
              <p className="break-all">
                Manual setup key: <strong>{secret}</strong>
              </p>
            </div>
          ) : (
            <p className="text-sm text-neutral-600">
              Enter the six-digit code from your authenticator app to continue.
            </p>
          )}
          <FormField
            label="Authenticator code"
            id="admin-mfa-code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            placeholder="123456"
            required
          />
        </>
      )}

      {noticeMessage ? (
        <p role="status" className="text-sm text-neutral-600">
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
        disabled={isLoading || (step === "credentials" && !consentAccepted)}
        aria-busy={isLoading}
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <Spinner className="h-4 w-4" />
            {step === "credentials"
              ? "Signing in..."
              : step === "enroll"
                ? "Setting up MFA..."
                : "Verifying..."}
          </span>
        ) : step === "credentials" ? (
          "Sign In as Admin"
        ) : step === "enroll" ? (
          "Enable MFA and Sign In"
        ) : (
          "Verify and Sign In"
        )}
      </Button>
    </form>
  );
}
