"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchFilter } from "@/components/dashboard/search-filter";
import { PixelButton, PixelInput } from "@/components/ui/pixel-primitives";
import { PixelModal } from "@/components/ui/pixel-modal";
import { getStatusLabel } from "@/lib/search/config";
import type { SearchItem, SearchRole } from "@/lib/search/types";

type QuizItem = Extract<SearchItem, { entity: "quizzes" }>;

function isQuiz(item: SearchItem): item is QuizItem {
  return item.entity === "quizzes";
}

function apiError(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("error" in body)) {
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

  return typeof error === "string" ? error : null;
}

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeZone: "Asia/Manila",
});

function formatDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

/**
 * The quizzes table for the admin and teacher dashboards: the usual search,
 * filters and pagination, plus a View and a Delete button on every row.
 */
export function ManageQuizzesTable({ actorRole }: { actorRole: SearchRole }) {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewTarget, setViewTarget] = useState<QuizItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuizItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [feedback, setFeedback] = useState("");
  const [feedbackKind, setFeedbackKind] = useState<"success" | "error" | null>(
    null,
  );

  // The delete button stays disabled until the word DELETE is typed.
  const confirmReady = confirmText.trim().toUpperCase() === "DELETE";

  function closeDeleteDialog() {
    setDeleteTarget(null);
    setConfirmText("");
  }

  async function deleteQuiz() {
    if (!deleteTarget || deleting || !confirmReady) {
      return;
    }

    setDeleting(true);
    setFeedback("");
    setFeedbackKind(null);

    try {
      const response = await fetch("/api/quizzes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", quizId: deleteTarget.id }),
        cache: "no-store",
      });
      let result: unknown = null;

      try {
        result = await response.json();
      } catch {
        result = null;
      }

      if (!response.ok) {
        throw new Error(apiError(result) ?? "Unable to delete the quiz.");
      }

      setFeedback("Quiz deleted.");
      setFeedbackKind("success");
      setRefreshKey((key) => key + 1);
      router.refresh();
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Unable to delete the quiz.",
      );
      setFeedbackKind("error");
    } finally {
      closeDeleteDialog();
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-2 sm:space-y-3">
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
        entity="quizzes"
        renderActions={(item) =>
          isQuiz(item) ? (
            // Phones: both buttons share the cell width, compact text.
            // sm and up: natural width, regular text.
            <div className="flex w-full gap-1.5 sm:w-auto sm:gap-2 [&>button]:flex-1 [&>button]:px-2.5 [&>button]:text-xs sm:[&>button]:flex-none sm:[&>button]:px-3 sm:[&>button]:text-sm">
              <PixelButton
                type="button"
                variant="accent"
                size="sm"
                aria-label={`View ${item.title}`}
                onClick={() => setViewTarget(item)}
              >
                View
              </PixelButton>
              <PixelButton
                type="button"
                variant="danger"
                size="sm"
                aria-label={`Delete ${item.title}`}
                onClick={() => setDeleteTarget(item)}
              >
                Delete
              </PixelButton>
            </div>
          ) : null
        }
      />

      {viewTarget ? (
        <PixelModal title="Quiz details" onClose={() => setViewTarget(null)}>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-neutral-500">Title</dt>
              <dd className="font-semibold text-foreground">
                {viewTarget.title}
              </dd>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-neutral-500">Status</dt>
                <dd className="font-semibold text-foreground">
                  {getStatusLabel("quizzes", viewTarget.status)}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Questions</dt>
                <dd className="font-semibold text-foreground">
                  {viewTarget.questionCount}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Teacher</dt>
                <dd className="font-semibold text-foreground">
                  {viewTarget.teacherUsername || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-neutral-500">Created</dt>
                <dd className="font-semibold text-foreground">
                  {formatDate(viewTarget.createdAt)}
                </dd>
              </div>
            </div>
          </dl>
          <div className="mt-4 flex justify-end">
            <PixelButton
              type="button"
              variant="neutral"
              onClick={() => setViewTarget(null)}
            >
              Close
            </PixelButton>
          </div>
        </PixelModal>
      ) : null}

      {deleteTarget ? (
        <PixelModal
          title="Delete quiz"
          onClose={() => {
            if (!deleting) {
              closeDeleteDialog();
            }
          }}
        >
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void deleteQuiz();
            }}
          >
            <p className="text-sm">
              You are about to permanently delete{" "}
              <strong>{deleteTarget.title}</strong>. Its questions, student
              attempts and scores are deleted with it. This cannot be undone.
            </p>
            <label
              htmlFor="delete-quiz-confirm"
              className="block text-sm font-semibold"
            >
              Type DELETE to confirm
              <PixelInput
                id="delete-quiz-confirm"
                value={confirmText}
                onChange={(event) => setConfirmText(event.currentTarget.value)}
                autoComplete="off"
                autoCapitalize="characters"
                disabled={deleting}
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <PixelButton
                type="button"
                variant="danger"
                onClick={closeDeleteDialog}
                disabled={deleting}
              >
                Cancel
              </PixelButton>
              <PixelButton
                type="submit"
                variant="primary"
                disabled={!confirmReady || deleting}
              >
                {deleting ? "Deleting..." : "Confirm Delete"}
              </PixelButton>
            </div>
          </form>
        </PixelModal>
      ) : null}
    </div>
  );
}
