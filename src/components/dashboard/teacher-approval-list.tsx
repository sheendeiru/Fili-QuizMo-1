"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useNavigation } from "@/components/pixel";
import { getStatusLabel } from "@/lib/search/config";
import type { DashboardTeacher } from "@/lib/dashboard/data";
import type { TeacherStatusUpdate } from "@/lib/auth/teacher-status";

type TeacherApprovalListProps = {
  teachers: readonly DashboardTeacher[];
};

type Action = {
  status: TeacherStatusUpdate;
  label: string;
  variant: "primary" | "outline";
};

function actionsFor(status: string): Action[] {
  if (status === "pending") {
    return [
      { status: "approved", label: "Approve", variant: "primary" },
      { status: "rejected", label: "Reject", variant: "outline" },
    ];
  }

  if (status === "approved") {
    return [{ status: "suspended", label: "Suspend", variant: "outline" }];
  }

  return [{ status: "approved", label: "Approve", variant: "primary" }];
}

export function TeacherApprovalList({
  teachers,
}: TeacherApprovalListProps) {
  const router = useRouter();
  const { navigate } = useNavigation();
  const [overrides, setOverrides] = useState<
    Record<string, TeacherStatusUpdate>
  >({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function updateStatus(
    teacherId: string,
    status: TeacherStatusUpdate,
  ) {
    setBusyId(teacherId);
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
          status,
        }),
        cache: "no-store",
      });
      let body: unknown = null;

      try {
        body = await response.json();
      } catch {
        body = null;
      }

      if (!response.ok) {
        const message =
          typeof body === "object" &&
          body !== null &&
          "error" in body &&
          typeof (body as { error?: { message?: unknown } }).error
            ?.message === "string"
            ? (body as { error: { message: string } }).error.message
            : "Unable to update the teacher account.";

        throw new Error(message);
      }

      setOverrides((current) => ({
        ...current,
        [teacherId]: status,
      }));
      navigate(() => router.refresh());
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update the teacher account.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (teachers.length === 0) {
    return (
      <p className="rounded-xl bg-white p-6 text-sm text-neutral-600">
        No teacher accounts have been created yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p
          role="alert"
          className="border-2 border-red-400 bg-red-950/60 px-4 py-3 text-sm text-red-200"
        >
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="min-w-full divide-y divide-neutral-200 text-left text-sm">
          <caption className="sr-only">Teacher account approval</caption>
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-6 py-4 font-semibold text-foreground">
                Teacher
              </th>
              <th className="px-6 py-4 font-semibold text-foreground">Email</th>
              <th className="px-6 py-4 font-semibold text-foreground">Status</th>
              <th className="px-6 py-4 font-semibold text-foreground">Quizzes</th>
              <th className="px-6 py-4 font-semibold text-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {teachers.map((teacher) => {
              const status = overrides[teacher.id] ?? teacher.status;
              const busy = busyId === teacher.id;

              return (
                <tr key={teacher.id}>
                  <td className="px-6 py-4 font-medium text-foreground">
                    {teacher.username}
                  </td>
                  <td className="px-6 py-4 text-neutral-600">
                    {teacher.email || "—"}
                  </td>
                  <td className="px-6 py-4 text-neutral-600">
                    {getStatusLabel("teachers", status)}
                  </td>
                  <td className="px-6 py-4 text-neutral-600">
                    {teacher.quizCount}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      {actionsFor(status).map((action) => (
                        <Button
                          key={`${teacher.id}-${action.status}`}
                          type="button"
                          variant={action.variant}
                          disabled={busy || busyId !== null}
                          onClick={() =>
                            void updateStatus(teacher.id, action.status)
                          }
                          className="px-3 py-1.5 text-xs"
                        >
                          {busy ? "Saving..." : action.label}
                        </Button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-neutral-500">
        Teachers must be approved before they can sign in to the teacher
        dashboard.
      </p>
    </div>
  );
}
