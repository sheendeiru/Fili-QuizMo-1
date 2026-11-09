"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AddStudentsModal } from "@/components/dashboard/add-students-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PixelModal } from "@/components/ui/pixel-modal";
import {
  PixelBadge,
  PixelButton,
  PixelCard,
  PixelInput,
} from "@/components/ui/pixel-primitives";
import {
  createClass,
  deleteClass,
  listClasses,
  MAX_CLASS_NAME,
  removeStudent,
  renameClass,
  type ClassStudent,
  type TeacherClass,
} from "@/lib/classes/client";

type Feedback = { kind: "success" | "error"; text: string } | null;
type RemoveTarget = { classItem: TeacherClass; student: ClassStudent };

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/**
 * The teacher's classes: create one, add or remove students, delete it.
 * Quizzes sent to a class reach whoever is in it when the student opens their
 * quiz list, so changes here apply to quizzes already sent.
 */
export function ManageClasses() {
  const [classes, setClasses] = useState<TeacherClass[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addTarget, setAddTarget] = useState<TeacherClass | null>(null);
  const [renameTarget, setRenameTarget] = useState<TeacherClass | null>(null);
  const [renameText, setRenameText] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TeacherClass | null>(null);
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    listClasses()
      .then((rows) => {
        if (cancelled) return;
        setClasses(rows);
        setLoadError("");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(
          error instanceof Error ? error.message : "Unable to load classes.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function reload() {
    setReloadKey((key) => key + 1);
  }

  function toggleExpanded(classId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  }

  async function submitNew(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (creating || !trimmed) return;

    setCreating(true);
    setFeedback(null);
    try {
      await createClass(trimmed);
      setName("");
      setFeedback({ kind: "success", text: `Class "${trimmed}" created.` });
      reload();
    } catch (error) {
      setFeedback({
        kind: "error",
        text: error instanceof Error ? error.message : "Unable to create the class.",
      });
    } finally {
      setCreating(false);
    }
  }

  function submitRename(event: FormEvent) {
    event.preventDefault();
    if (!renameTarget || busy) return;

    const { classId, name: oldName } = renameTarget;
    const next = renameText.trim();
    if (!next || next === oldName) {
      setRenameTarget(null);
      return;
    }

    void runAction(
      () => renameClass(classId, next),
      `Class renamed to "${next}".`,
      () => setRenameTarget(null),
    );
  }

  // Runs a delete/remove, then closes its dialog and reports the result.
  async function runAction(
    action: () => Promise<void>,
    success: string,
    close: () => void,
  ) {
    setBusy(true);
    setFeedback(null);
    try {
      await action();
      setFeedback({ kind: "success", text: success });
      reload();
    } catch (error) {
      setFeedback({
        kind: "error",
        text: error instanceof Error ? error.message : "The request failed.",
      });
    } finally {
      setBusy(false);
      close();
    }
  }

  return (
    <div className="space-y-2 sm:space-y-3">
      {feedback ? (
        <p
          role={feedback.kind === "error" ? "alert" : "status"}
          className={`border-2 p-3 text-sm ${
            feedback.kind === "error"
              ? "border-danger-dark bg-danger-surface text-danger-dark"
              : "border-primary-dark bg-primary/15 text-ink"
          }`}
        >
          {feedback.text}
        </p>
      ) : null}

      <form onSubmit={submitNew} aria-label="Create a class">
        <PixelCard>
        <label htmlFor="new-class-name" className="text-sm font-semibold">
          New class
        </label>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <PixelInput
            id="new-class-name"
            value={name}
            maxLength={MAX_CLASS_NAME}
            placeholder="e.g. Grade 7 - Rizal"
            autoComplete="off"
            onChange={(event) => setName(event.target.value)}
          />
          <PixelButton type="submit" disabled={creating || !name.trim()}>
            {creating ? "Creating..." : "Create class"}
          </PixelButton>
        </div>
        </PixelCard>
      </form>

      {loadError && classes === null ? (
        <div role="alert" className="border-2 border-danger-dark bg-danger-surface p-3 text-sm text-danger-dark">
          <p>{loadError}</p>
          <PixelButton type="button" size="sm" className="mt-2" onClick={reload}>
            Try again
          </PixelButton>
        </div>
      ) : classes === null ? (
        <p role="status" className="text-sm text-px-muted">
          Loading classes...
        </p>
      ) : classes.length === 0 ? (
        <PixelCard>
          <p className="text-sm">
            You have no classes yet. Create one above, add your students, then
            send a quiz to it from the app.
          </p>
        </PixelCard>
      ) : (
        <ul className="space-y-2 sm:space-y-3">
          {classes.map((item) => {
            const open = expanded.has(item.classId);
            const panelId = `class-students-${item.classId}`;

            return (
              <li key={item.classId}>
                <PixelCard>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold">{item.name}</h3>
                      <PixelBadge>{plural(item.students.length, "student")}</PixelBadge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <PixelButton
                        type="button"
                        size="sm"
                        variant="neutral"
                        aria-expanded={open}
                        aria-controls={panelId}
                        onClick={() => toggleExpanded(item.classId)}
                      >
                        {open ? "Hide students" : "Show students"}
                      </PixelButton>
                      <PixelButton
                        type="button"
                        size="sm"
                        variant="accent"
                        aria-label={`Add students to ${item.name}`}
                        onClick={() => setAddTarget(item)}
                      >
                        Add students
                      </PixelButton>
                      <PixelButton
                        type="button"
                        size="sm"
                        variant="neutral"
                        aria-label={`Rename class ${item.name}`}
                        onClick={() => {
                          setRenameText(item.name);
                          setRenameTarget(item);
                        }}
                      >
                        Rename
                      </PixelButton>
                      <PixelButton
                        type="button"
                        size="sm"
                        variant="danger"
                        aria-label={`Delete class ${item.name}`}
                        onClick={() => setDeleteTarget(item)}
                      >
                        Delete
                      </PixelButton>
                    </div>
                  </div>

                  {open ? (
                    <div id={panelId} className="mt-3">
                      {item.students.length === 0 ? (
                        <p className="text-sm text-px-muted">
                          No students in this class yet.
                        </p>
                      ) : (
                        <ul className="divide-y-2 divide-ink/20 border-2 border-ink text-sm">
                          {item.students.map((student) => (
                            <li
                              key={student.userId}
                              className="flex items-center justify-between gap-2 px-3 py-1.5"
                            >
                              <span className="break-all">{student.username}</span>
                              <PixelButton
                                type="button"
                                size="sm"
                                variant="outline"
                                aria-label={`Remove ${student.username} from ${item.name}`}
                                onClick={() =>
                                  setRemoveTarget({ classItem: item, student })
                                }
                              >
                                Remove
                              </PixelButton>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </PixelCard>
              </li>
            );
          })}
        </ul>
      )}

      {addTarget ? (
        <AddStudentsModal
          target={addTarget}
          onClose={() => setAddTarget(null)}
          onAdded={(added) => {
            setExpanded((current) => new Set(current).add(addTarget.classId));
            setFeedback({
              kind: "success",
              text:
                added > 0
                  ? `${plural(added, "student")} added to ${addTarget.name}.`
                  : "Those students were already in the class.",
            });
            setAddTarget(null);
            reload();
          }}
        />
      ) : null}

      {renameTarget ? (
        <PixelModal
          title="Rename class"
          onClose={() => {
            if (!busy) setRenameTarget(null);
          }}
          className="max-w-md"
        >
          <form onSubmit={submitRename} className="space-y-3 text-sm">
            <label htmlFor="rename-class-name" className="block font-semibold">
              Class name
            </label>
            <PixelInput
              id="rename-class-name"
              value={renameText}
              maxLength={MAX_CLASS_NAME}
              autoComplete="off"
              onChange={(event) => setRenameText(event.target.value)}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <PixelButton
                type="button"
                variant="neutral"
                disabled={busy}
                onClick={() => setRenameTarget(null)}
              >
                Cancel
              </PixelButton>
              <PixelButton type="submit" disabled={busy || !renameText.trim()}>
                {busy ? "Saving..." : "Save"}
              </PixelButton>
            </div>
          </form>
        </PixelModal>
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete class"
        message={`Delete "${deleteTarget?.name ?? ""}"? Students stop seeing quizzes that were sent only to this class. Their accounts and past results are not affected.`}
        confirmLabel="Delete class"
        pending={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          void runAction(
            () => deleteClass(deleteTarget.classId),
            `Class "${deleteTarget.name}" deleted.`,
            () => setDeleteTarget(null),
          );
        }}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        title="Remove student"
        message={`Remove ${removeTarget?.student.username ?? ""} from "${removeTarget?.classItem.name ?? ""}"? They stop seeing quizzes that were sent only to this class.`}
        confirmLabel="Remove student"
        pending={busy}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (!removeTarget) return;
          const { classItem, student } = removeTarget;
          void runAction(
            () => removeStudent(classItem.classId, student.userId),
            `${student.username} removed from ${classItem.name}.`,
            () => setRemoveTarget(null),
          );
        }}
      />
    </div>
  );
}
