"use client";

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SearchFilter } from "@/components/dashboard/search-filter";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  PixelButton,
  PixelInput,
} from "@/components/ui/pixel-primitives";
import { PixelModal } from "@/components/ui/pixel-modal";
import type { DashboardTeacher } from "@/lib/dashboard/data";
import type { SearchItem, SearchRole } from "@/lib/search/types";

type ManagedRole = "student" | "teacher";

function apiError(body: unknown): string | null {
  if (
    typeof body !== "object" ||
    body === null ||
    !("error" in body)
  ) {
    return null;
  }

  const error = body.error;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return null;
}

export function ManageAccountsTable({
  actorRole,
  accountRole,
  teachers = [],
  renderExtraActions,
}: {
  actorRole: SearchRole;
  accountRole: ManagedRole;
  teachers?: readonly DashboardTeacher[];
  renderExtraActions?: (item: SearchItem) => ReactNode;
}) {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SearchItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackKind, setFeedbackKind] = useState<
    "success" | "error" | null
  >(null);

  const pageEntity = accountRole === "teacher" ? "teachers" : "students";
  const approvedTeachers = teachers.filter(
    (teacher) => teacher.status === "approved",
  );

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const username = String(formData.get("username") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const teacherId = String(formData.get("teacherId") ?? "");
    const body = {
      action: "create",
      accountRole,
      username,
      email,
      ...(password ? { password } : {}),
      ...(accountRole === "student" && actorRole === "admin" && teacherId
        ? { teacherId }
        : {}),
    };

    setCreating(true);
    setCreateError("");
    setFeedback("");
    setFeedbackKind(null);

    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const result: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          apiError(result) ?? "Unable to create the account.",
        );
      }

      const temporaryPassword =
        typeof result === "object" &&
        result !== null &&
        "temporary_password" in result &&
        typeof result.temporary_password === "string"
          ? result.temporary_password
          : null;

      setFeedback(
        temporaryPassword
          ? `Account created. Share this temporary password securely: ${temporaryPassword}`
          : "Account created.",
      );
      setFeedbackKind("success");
      form.reset();
      setCreateOpen(false);
      setRefreshKey((key) => key + 1);
      router.refresh();
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Unable to create the account.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function deleteAccount() {
    if (!deleteTarget || deleting) {
      return;
    }

    setDeleting(true);
    setFeedback("");
    setFeedbackKind(null);

    try {
      const response = await fetch("/api/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          accountRole,
          accountId: deleteTarget.id,
        }),
        cache: "no-store",
      });
      const result: unknown = await response.json();

      if (!response.ok) {
        throw new Error(
          apiError(result) ?? "Unable to delete the account.",
        );
      }

      setDeleteTarget(null);
      setFeedback("Account deleted.");
      setFeedbackKind("success");
      setRefreshKey((key) => key + 1);
      router.refresh();
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Unable to delete the account.",
      );
      setFeedbackKind("error");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      {feedback ? (
        <p
          role={feedbackKind === "error" ? "alert" : "status"}
          aria-live={feedbackKind === "error" ? "assertive" : "polite"}
          className={`border-2 p-3 text-sm ${
            feedbackKind === "error"
              ? "border-danger-dark bg-danger-surface text-danger-dark"
              : "border-primary-dark bg-primary/15 text-ink"
          }`}
        >
          {feedback}
        </p>
      ) : null}
      <SearchFilter
        key={refreshKey}
        role={actorRole}
        entity={pageEntity}
        toolbar={
          <PixelButton
            type="button"
            variant="primary"
            onClick={() => {
              setCreateError("");
              setCreateOpen(true);
            }}
          >
            Create
          </PixelButton>
        }
        renderActions={(item) => (
          <div className="flex flex-wrap gap-2">
            {renderExtraActions?.(item)}
            <PixelButton
              type="button"
              variant="danger"
              size="sm"
              onClick={() => setDeleteTarget(item)}
            >
              Delete
            </PixelButton>
          </div>
        )}
      />

      {createOpen ? (
        <PixelModal
          title={`Create ${accountRole} account`}
          onClose={() => {
            if (!creating) {
              setCreateOpen(false);
            }
          }}
        >
          <form className="space-y-3" onSubmit={(event) => void createAccount(event)}>
            <label htmlFor="account-username" className="block text-sm font-semibold">
              Name / username
              <PixelInput
                id="account-username"
                name="username"
                autoComplete="username"
                minLength={3}
                maxLength={15}
                pattern="[A-Za-z][A-Za-z0-9_]{2,14}"
                required
              />
            </label>
            <label htmlFor="account-email" className="block text-sm font-semibold">
              Email
              <PixelInput
                id="account-email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
              />
            </label>
            {accountRole === "student" && actorRole === "admin" ? (
              <label htmlFor="account-teacher" className="block text-sm font-semibold">
                Managing teacher (optional)
                <select
                  id="account-teacher"
                  name="teacherId"
                  defaultValue=""
                  className="pixel-input mt-1 h-10 w-full px-3 text-sm"
                >
                  <option value="">Unassigned</option>
                  {approvedTeachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.username}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label htmlFor="account-password" className="block text-sm font-semibold">
              Temporary password
              <PixelInput
                id="account-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                aria-describedby="account-password-help"
              />
              <span id="account-password-help" className="mt-1 block text-xs font-normal">
                Leave blank to generate a one-time password.
              </span>
            </label>
            {createError ? (
              <p role="alert" className="text-sm">{createError}</p>
            ) : null}
            <div className="flex justify-end gap-2 pt-1">
              <PixelButton
                type="button"
                variant="danger"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                Cancel
              </PixelButton>
              <PixelButton type="submit" variant="primary" disabled={creating}>
                {creating ? "Creating..." : "Confirm"}
              </PixelButton>
            </div>
          </form>
        </PixelModal>
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete account"
        message="Delete this account? This cannot be undone."
        confirmLabel="Confirm Delete"
        pending={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void deleteAccount()}
      />
    </div>
  );
}
