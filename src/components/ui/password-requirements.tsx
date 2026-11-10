"use client";

import { Fragment, useMemo } from "react";
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
  create: "Password needs one of these:",
  change: "New password needs one of these:",
  reset: "New password needs one of these:",
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

  // The two ways to be long enough are alternatives, so the one not used is
  // never marked as a failure: it is just not ticked.
  const options: RequirementCheck[] = validation.results
    .filter((result) => result.kind === "option")
    .map((result) => ({
      id: result.id,
      label: result.label,
      example: result.example,
      state: touched && result.passed ? "passed" : "neutral",
    }));

  // Everything else is shown only when it is actually a problem, and only once
  // the password is long enough to be judged, so the first few letters of a
  // normal password never flash a warning.
  const longEnough = options.some((check) => check.state === "passed");
  const problems: RequirementCheck[] = touched
    ? validation.results
        .filter(
          (result) =>
            result.kind === "extra" &&
            !result.passed &&
            (longEnough || result.id === "max-length"),
        )
        .map((result) => ({
          id: result.id,
          label: result.label,
          state: "unmet",
        }))
    : [];

  const matchCheck: RequirementCheck | null =
    confirmPassword !== undefined
      ? {
          id: "match",
          label: "Passwords match",
          state:
            password.length > 0 && confirmPassword.length > 0
              ? password === confirmPassword
                ? "passed"
                : "unmet"
              : "neutral",
        }
      : null;

  const rows: RequirementCheck[] = [...problems, ...(matchCheck ? [matchCheck] : [])];
  const unmetRows = rows.filter((check) => check.state === "unmet");
  const announcement = !touched
    ? ""
    : unmetRows.length > 0
      ? `Still needed: ${unmetRows.map((check) => check.label).join(", ")}.`
      : !validation.valid
        ? `Still needed: ${options.map((check) => check.label).join(", or ")}.`
        : matchCheck && matchCheck.state !== "passed"
          ? ""
          : "All password requirements met.";

  function renderRow(check: RequirementCheck) {
    return (
      <li key={check.id} className="flex items-start gap-1 leading-tight!">
        <span className={`mt-0.5 shrink-0 ${ICON_COLORS[check.state]}`}>
          <RuleIcon state={check.state} />
        </span>
        <span className={TEXT_COLORS[check.state]}>
          {check.label}
          {check.example ? <span> ({check.example})</span> : null}
        </span>
      </li>
    );
  }

  return (
    <div id={PASSWORD_REQUIREMENTS_ID} className={`text-xs ${className}`.trim()}>
      <p className="font-semibold text-foreground leading-tight!">{HEADINGS[context]}</p>
      <ul className="mt-0.5 space-y-0">
        {options.map((check, index) => (
          <Fragment key={check.id}>
            {index > 0 ? (
              <li
                aria-hidden="true"
                className="pl-4 font-semibold uppercase leading-tight! text-neutral-500"
              >
                or
              </li>
            ) : null}
            {renderRow(check)}
          </Fragment>
        ))}
      </ul>
      {rows.length > 0 ? (
        <ul className="mt-0.5 space-y-0">{rows.map(renderRow)}</ul>
      ) : null}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}
