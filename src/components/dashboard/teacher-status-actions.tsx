"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PixelButton } from "@/components/ui/pixel-primitives";
import type { TeacherStatusUpdate } from "@/lib/auth/teacher-status";
import { DASHBOARD_DATA_CHANGED_EVENT } from "@/lib/dashboard/realtime-events";

type Action = {
  status: TeacherStatusUpdate;
  label: string;
  variant: "primary" | "danger";
};

function actionsFor(status: string): Action[] {
  if (status === "pending") {
    return [
      { status: "approved", label: "Approve", variant: "primary" },
      { status: "rejected", label: "Reject", variant: "danger" },
    ];
  }

  if (status === "approved") {
    return [{ status: "suspended", label: "Suspend", variant: "danger" }];
  }

  return [{ status: "approved", label: "Approve", variant: "primary" }];
}

function errorMessage(body: unknown): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "object" &&
    body.error !== null &&
    "message" in body.error &&
    typeof body.error.message === "string"
  ) {
    return body.error.message;
  }

  return "Unable to update the teacher account.";
}

/**
 * Approve / Reject / Suspend buttons for one teacher row.
 *
 * Loading works like the navbar Login buttons: only the clicked button turns
 * into an inline spinner ("Saving...") and the others are disabled. There is no
 * full-screen loader, and the table keeps its rows while it refreshes.
 */
export function TeacherStatusActions({
  teacherId,
  status,
}: {
  teacherId: string;
  status: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busyStatus, setBusyStatus] = useState<TeacherStatusUpdate | null>(
    null,
  );
  const [error, setError] = useState("");
  // Show the new status straight away. The override drops itself as soon as the
  // table sends a different status for this row (i.e. after the refetch).
  const [override, setOverride] = useState<{
    from: string;
    to: TeacherStatusUpdate;
  } | null>(null);
  const inFlight = useRef(false);

  const currentStatus =
    override && override.from === status ? override.to : status;

  async function updateStatus(next: TeacherStatusUpdate) {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    setBusyStatus(next);
    setError("");

    try {
      const response = await fetch("/api/admin/teachers/status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ teacherId: Number(teacherId), status: next }),
        cache: "no-store",
      });
      let body: unknown = null;

      try {
        body = await response.json();
      } catch {
        body = null;
      }

      if (!response.ok) {
        throw new Error(errorMessage(body));
      }

      setOverride({ from: status, to: next });
      // Re-run the table's search in place (rows stay on screen) and refresh
      // the stat cards and charts without a page-level loading screen.
      window.dispatchEvent(new Event(DASHBOARD_DATA_CHANGED_EVENT));
      startTransition(() => router.refresh());
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update the teacher account.",
      );
    } finally {
      inFlight.current = false;
      setBusyStatus(null);
    }
  }

  return (
    // `contents`: the buttons join the row's own flex layout (see
    // ManageAccountsTable), so they stack with equal widths on phones.
    <div className="contents">
      {actionsFor(currentStatus).map((action) => {
        const busy = busyStatus === action.status;

        return (
          <PixelButton
            key={action.status}
            type="button"
            size="sm"
            variant={action.variant}
            disabled={busyStatus !== null}
            aria-busy={busy}
            aria-label={busy ? `Saving ${action.label}` : action.label}
            onClick={() => void updateStatus(action.status)}
            className="w-full whitespace-nowrap sm:w-auto"
          >
            {busy ? (
              <span
                aria-hidden="true"
                className="pixel-spinner h-4 w-4 shrink-0"
              >
                <span />
                <span />
                <span />
                <span />
              </span>
            ) : null}
            <span>{busy ? "Saving..." : action.label}</span>
          </PixelButton>
        );
      })}
      {error ? (
        <p
          role="alert"
          className="w-full max-w-44 break-words text-xs text-danger-dark"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
