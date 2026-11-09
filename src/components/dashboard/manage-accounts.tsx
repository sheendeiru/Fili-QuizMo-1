"use client";

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SearchFilter } from "@/components/dashboard/search-filter";
import { StudentQuizzesModal } from "@/components/dashboard/student-quizzes-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PasswordRequirements, PASSWORD_REQUIREMENTS_ID } from "@/components/ui/password-requirements";
import {
  PixelButton,
  PixelInput,
} from "@/components/ui/pixel-primitives";
import { PixelModal } from "@/components/ui/pixel-modal";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validatePassword,
} from "@/lib/password-policy";
import {
  deleteAccountsOneByOne,
  summarizeBulkDelete,
} from "@/lib/dashboard/bulk-delete";
import type { DashboardTeacher } from "@/lib/dashboard/data";
import { DASHBOARD_DATA_CHANGED_EVENT } from "@/lib/dashboard/realtime-events";
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

/**
 * Which actions a table offers. Student rows get View (the quizzes that
 * student took) and are deleted in bulk with the Delete button beside Create,
 * which lets the teacher or admin tick several students first. Teacher rows
 * keep their own Delete button.
 */
export function rowActionsFor(accountRole: ManagedRole): {
  canView: boolean;
  canDelete: boolean;
  canBulkDelete: boolean;
} {
  return {
    canView: accountRole === "student",
    canDelete: accountRole === "teacher",
    canBulkDelete: accountRole === "student",
  };
}

async function deleteAccountRequest(
  accountRole: ManagedRole,
  accountId: string,
): Promise<void> {
  const response = await fetch("/api/accounts", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", accountRole, accountId }),
    cache: "no-store",
  });
  const result: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(apiError(result) ?? "Unable to delete the account.");
  }
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
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SearchItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewTarget, setViewTarget] = useState<{
    id: string;
    username: string;
  } | null>(null);
  // Bulk delete: pressing Delete turns on selection; students stay ticked
  // across pages until deleted or cancelled.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackKind, setFeedbackKind] = useState<
    "success" | "error" | null
  >(null);
  const [createUsername, setCreateUsername] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");

  const pageEntity = accountRole === "teacher" ? "teachers" : "student_accounts";
  const { canView, canDelete, canBulkDelete } = rowActionsFor(accountRole);
  const selectedCount = selectedIds.size;
  const approvedTeachers = teachers.filter(
    (teacher) => teacher.status === "approved",
  );

  // Re-run the table's search in place (the rows stay on screen, so no loading
  // screen) and refresh the stat cards and charts behind it.
  function refreshTable() {
    window.dispatchEvent(new Event(DASHBOARD_DATA_CHANGED_EVENT));
    router.refresh();
  }

  function closeCreateModal() {
    if (creating) return;

    setCreateOpen(false);
    setCreateError("");
    setCreateUsername("");
    setCreateEmail("");
    setCreatePassword("");
  }

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

    if (password && !validatePassword(password, [email, username]).valid) {
      setCreateError(
        "The temporary password does not meet all of the requirements.",
      );
      return;
    }

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
      setCreateUsername("");
      setCreateEmail("");
      setCreatePassword("");
      setCreateOpen(false);
      refreshTable();
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
      await deleteAccountRequest(accountRole, deleteTarget.id);

      setDeleteTarget(null);
      setFeedback("Account deleted.");
      setFeedbackKind("success");
      refreshTable();
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

  function toggleSelected(id: string, selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }

      return next;
    });
  }

  function exitSelectMode() {
    if (deleting) return;

    setSelectMode(false);
    setSelectedIds(new Set());
    setBulkConfirmOpen(false);
    // An earlier "could not be deleted" message no longer applies once the
    // teacher backs out of selecting.
    setFeedback("");
    setFeedbackKind(null);
  }

  async function deleteSelected() {
    if (deleting || selectedIds.size === 0) {
      return;
    }

    setDeleting(true);
    setFeedback("");
    setFeedbackKind(null);

    const result = await deleteAccountsOneByOne([...selectedIds], (id) =>
      deleteAccountRequest("student", id),
    );
    const summary = summarizeBulkDelete(result);

    setBulkConfirmOpen(false);
    setFeedback(summary.message);
    setFeedbackKind(summary.kind);
    // Whatever could not be deleted stays ticked so it can be retried.
    setSelectedIds(new Set(result.failed.map((failure) => failure.id)));
    if (result.failed.length === 0) {
      setSelectMode(false);
    }
    setDeleting(false);

    if (result.deleted.length > 0) {
      refreshTable();
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
      {canBulkDelete && selectMode ? (
        <p
          role="status"
          aria-live="polite"
          className="border-2 border-ink bg-accent/20 p-3 text-sm"
        >
          {`Tick the students you want to delete, then press Delete. ${
            selectedCount === 1
              ? "1 student is selected."
              : `${selectedCount} students are selected.`
          }`}
        </p>
      ) : null}
      <SearchFilter
        role={actorRole}
        entity={pageEntity}
        toolbar={
          // The toolbar is right-aligned over the table, so Delete ends flush
          // with the table's right edge and Create sits just to its left.
          <>
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
            {canBulkDelete && selectMode ? (
              <PixelButton
                type="button"
                variant="neutral"
                onClick={exitSelectMode}
                disabled={deleting}
              >
                Cancel
              </PixelButton>
            ) : null}
            {canBulkDelete ? (
              <PixelButton
                type="button"
                variant="danger"
                disabled={deleting || (selectMode && selectedCount === 0)}
                onClick={() => {
                  if (selectMode) {
                    setBulkConfirmOpen(true);
                  } else {
                    setFeedback("");
                    setFeedbackKind(null);
                    setSelectMode(true);
                  }
                }}
              >
                {selectMode ? `Delete (${selectedCount})` : "Delete"}
              </PixelButton>
            ) : null}
          </>
        }
        renderActions={(item) => (
          // Phones: buttons stack and share one width, and the labels never
          // wrap ("Suspen/d"). From sm up they sit side by side.
          <div className="flex w-full min-w-28 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            {renderExtraActions?.(item)}
            {canBulkDelete && selectMode ? (
              <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  disabled={deleting}
                  onChange={(event) =>
                    toggleSelected(item.id, event.currentTarget.checked)
                  }
                  aria-label={
                    "username" in item
                      ? `Select ${item.username} for deletion`
                      : "Select for deletion"
                  }
                  className="h-5 w-5 shrink-0 accent-danger-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                />
                Select
              </label>
            ) : null}
            {canView ? (
              <PixelButton
                type="button"
                variant="primary"
                size="sm"
                onClick={() =>
                  setViewTarget({
                    id: item.id,
                    username: "username" in item ? item.username : "",
                  })
                }
                aria-label={
                  "username" in item
                    ? `View quizzes taken by ${item.username}`
                    : "View quizzes taken"
                }
                className="w-full whitespace-nowrap sm:w-auto"
              >
                View
              </PixelButton>
            ) : null}
            {canDelete ? (
              <PixelButton
                type="button"
                variant="danger"
                size="sm"
                onClick={() => setDeleteTarget(item)}
                className="w-full whitespace-nowrap sm:w-auto"
              >
                Delete
              </PixelButton>
            ) : null}
          </div>
        )}
      />

      {createOpen ? (
        <PixelModal
          title={`Create ${accountRole} account`}
          onClose={closeCreateModal}
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
                value={createUsername}
                onChange={(event) => setCreateUsername(event.target.value)}
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
                value={createEmail}
                onChange={(event) => setCreateEmail(event.target.value)}
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
            <div>
              <label htmlFor="account-password" className="block text-sm font-semibold">
                Temporary password
              </label>
              <PixelInput
                id="account-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={PASSWORD_MAX_LENGTH}
                aria-describedby={`account-password-help ${PASSWORD_REQUIREMENTS_ID}`}
                value={createPassword}
                onChange={(event) => setCreatePassword(event.target.value)}
              />
              <span id="account-password-help" className="mt-1 block text-xs font-normal">
                Leave blank to generate a one-time password that meets the
                rules below.
              </span>
              <PasswordRequirements
                password={createPassword}
                email={createEmail}
                username={createUsername}
                context="create"
                className="mt-1"
              />
            </div>
            {createError ? (
              <p role="alert" className="text-sm">{createError}</p>
            ) : null}
            <div className="flex justify-end gap-2 pt-1">
              <PixelButton
                type="button"
                variant="danger"
                onClick={closeCreateModal}
                disabled={creating}
              >
                Cancel
              </PixelButton>
              <PixelButton
                type="submit"
                variant="primary"
                disabled={creating}
                aria-busy={creating}
              >
                {creating ? "Creating..." : "Confirm"}
              </PixelButton>
            </div>
          </form>
        </PixelModal>
      ) : null}

      {viewTarget ? (
        <StudentQuizzesModal
          key={viewTarget.id}
          studentId={viewTarget.id}
          username={viewTarget.username}
          onClose={() => setViewTarget(null)}
        />
      ) : null}

      <ConfirmDialog
        open={bulkConfirmOpen}
        title={selectedCount === 1 ? "Delete student" : "Delete students"}
        message={
          selectedCount === 1
            ? "Delete the selected student? Their account is permanently removed and cannot be restored. Their saved quiz results stay on record."
            : `Delete the ${selectedCount} selected students? Their accounts are permanently removed and cannot be restored. Their saved quiz results stay on record.`
        }
        confirmLabel={`Confirm Delete (${selectedCount})`}
        pending={deleting}
        onCancel={() => setBulkConfirmOpen(false)}
        onConfirm={() => void deleteSelected()}
      />

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
