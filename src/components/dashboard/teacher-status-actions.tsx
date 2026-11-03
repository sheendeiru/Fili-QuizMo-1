"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { TeacherStatusUpdate } from "@/lib/auth/teacher-status";

function actionsFor(status: string): Array<{
  status: TeacherStatusUpdate;
  label: string;
  variant: "primary" | "danger";
}> {
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

export function TeacherStatusActions({
  teacherId,
  status,
}: {
  teacherId: string;
  status: string;
}) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function updateStatus(nextStatus: TeacherStatusUpdate) {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/admin/teachers/status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          teacherId: Number(teacherId),
          status: nextStatus,
        }),
        cache: "no-store",
      });
      const body: unknown = await response.json();

      if (!response.ok) {
        const message =
          typeof body === "object" &&
          body !== null &&
          "error" in body &&
          typeof body.error === "object" &&
          body.error !== null &&
          "message" in body.error &&
          typeof body.error.message === "string"
            ? body.error.message
            : "Unable to update the teacher account.";
        throw new Error(message);
      }

      setCurrentStatus(nextStatus);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update the teacher account.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-1">
      {actionsFor(currentStatus).map((action) => (
        <Button
          key={`${teacherId}-${action.status}`}
          type="button"
          size="sm"
          variant={action.variant}
          disabled={busy}
          onClick={() => void updateStatus(action.status)}
        >
          {busy ? "Saving..." : action.label}
        </Button>
      ))}
      {error ? <span role="alert" className="basis-full">{error}</span> : null}
    </div>
  );
}
