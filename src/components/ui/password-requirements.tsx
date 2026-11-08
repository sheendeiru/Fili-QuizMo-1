"use client";

import { useMemo } from "react";
import { validatePassword } from "@/lib/password-policy";

export const PASSWORD_REQUIREMENTS_ID = "password-requirements";

type PasswordContext = "create" | "change" | "reset";
type CheckState = "neutral" | "passed" | "unmet";
type RequirementCheck = {
  id: string;
  label: string;
  example?: string;
  state: CheckState;
};

const HEADINGS: Record<PasswordContext, string> = {
  create: "Password must include:",
  change: "New password must include:",
  reset: "New password must include:",
};

const ICON_COLORS: Record<CheckState, string> = {
  neutral: "text-neutral-400",
  passed: "text-primary-dark",
  unmet: "text-danger-dark",
};

const TEXT_COLORS: Record<CheckState, string> = {
  neutral: "text-neutral-500",
  passed: "text-ink",
  unmet: "text-danger-dark",
};

function RuleIcon({ state }: { state: CheckState }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className="h-3 w-3"
    >
      {state === "passed" ? (
        <path d="M1 6h2v2H1zM3 8h2v2H3zM5 6h2v2H5zM7 4h2v2H7zM9 2h2v2H9z" />
      ) : state === "unmet" ? (
        <path d="M1 1h2v2H1zM3 3h2v2H3zM5 5h2v2H5zM7 7h2v2H7zM9 9h2v2H9zM9 1h2v2H9zM7 3h2v2H7zM3 7h2v2H3zM1 9h2v2H1z" />
      ) : (
        <path d="M1 1h10v2H1zM1 9h10v2H1zM1 3h2v6H1zM9 3h2v6H9z" />
      )}
    </svg>
  );
}

export function PasswordRequirements({
  password,
  confirmPassword,
  email = "",
  username = "",
  context = "create",
  className = "",
}: {
  password: string;
  confirmPassword?: string;
  email?: string;
  username?: string;
  context?: PasswordContext;
  className?: string;
}) {
  const validation = useMemo(
    () => validatePassword(password, [email, username]),
    [email, password, username],
  );
  const touched = password.length > 0;

  const checks: RequirementCheck[] = validation.results
    // Only surface the length limit when it is actually exceeded.
    .filter((result) => result.id !== "max-length" || !result.passed)
    .map((result) => ({
      id: result.id,
      label: result.label,
      example: result.example,
      state: !touched ? "neutral" : result.passed ? "passed" : "unmet",
    }));

  if (confirmPassword !== undefined) {
    const bothTyped = password.length > 0 && confirmPassword.length > 0;
    checks.push({
      id: "match",
      label: "Passwords match",
      example: "same",
      state: !bothTyped
        ? "neutral"
        : password === confirmPassword
          ? "passed"
          : "unmet",
    });
  }

  const unmet = checks.filter((check) => check.state === "unmet");
  const announcement = !touched
    ? ""
    : unmet.length > 0
      ? `Still needed: ${unmet.map((check) => check.label).join(", ")}.`
      : checks.every((check) => check.state === "passed")
        ? "All password requirements met."
        : "";

  return (
    <div id={PASSWORD_REQUIREMENTS_ID} className={`text-xs ${className}`.trim()}>
      <p className="font-semibold text-foreground leading-tight!">{HEADINGS[context]}</p>
      <ul className="mt-0.5 grid grid-cols-2 gap-x-2 gap-y-0">
        {checks.map((check) => (
          <li key={check.id} className="flex items-start gap-1 leading-tight!">
            <span className={`mt-0.5 shrink-0 ${ICON_COLORS[check.state]}`}>
              <RuleIcon state={check.state} />
            </span>
            <span className={TEXT_COLORS[check.state]}>
              {check.label}
              {check.example ? <span> ({check.example})</span> : null}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-0.5 leading-tight! text-neutral-500">
        Avoid common passwords like &quot;password123&quot;.
      </p>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}
