"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { PixelModal } from "@/components/ui/pixel-modal";
import { PixelButton, PixelInput } from "@/components/ui/pixel-primitives";
import {
  addStudents,
  listSuggestions,
  parseUsernames,
  type StudentSuggestion,
  type TeacherClass,
} from "@/lib/classes/client";

/**
 * Adds students to one class: tick suggested accounts (the teacher's own
 * students, with Select all) and/or type usernames. The server rejects the
 * whole request if any username has no account, and names it.
 */
export function AddStudentsModal({
  target,
  onClose,
  onAdded,
}: {
  target: TeacherClass;
  onClose: () => void;
  onAdded: (added: number) => void;
}) {
  const typedId = useId();
  const [suggestions, setSuggestions] = useState<StudentSuggestion[] | null>(
    null,
  );
  const [suggestionsError, setSuggestionsError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [typed, setTyped] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    listSuggestions()
      .then((rows) => {
        if (!cancelled) setSuggestions(rows);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setSuggestions([]);
        setSuggestionsError(
          loadError instanceof Error ? loadError.message : "",
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const inClass = new Set(target.students.map((student) => student.userId));
  const available = (suggestions ?? []).filter(
    (student) => !inClass.has(student.userId),
  );
  const allSelected =
    available.length > 0 && available.every((s) => selected.has(s.username));

  function toggle(username: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });
  }

  // Ticked suggestions plus typed names, without repeats.
  function chosenUsernames(): string[] {
    return parseUsernames([...selected, typed].join(" "));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const usernames = chosenUsernames();
    if (saving) return;
    if (usernames.length === 0) {
      setError("Choose or type at least one student username.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      onAdded(await addStudents(target.classId, usernames));
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to add students.",
      );
      setSaving(false);
    }
  }

  return (
    <PixelModal
      title={`Add students to ${target.name}`}
      onClose={() => {
        if (!saving) onClose();
      }}
      className="max-w-lg"
    >
      <form onSubmit={submit} className="space-y-4 text-sm">
        <fieldset>
          <legend className="font-semibold">Your students</legend>
          {suggestions === null ? (
            <p role="status" className="mt-2 text-px-muted">
              Loading your students...
            </p>
          ) : available.length === 0 ? (
            <p className="mt-2 text-px-muted">
              {suggestionsError ||
                "No more students to suggest. Type usernames below."}
            </p>
          ) : (
            <>
              <label className="mt-2 flex items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() =>
                    setSelected(
                      allSelected
                        ? new Set()
                        : new Set(available.map((s) => s.username)),
                    )
                  }
                />
                Select all ({available.length})
              </label>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto border-2 border-ink p-2">
                {available.map((student) => (
                  <li key={student.userId}>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selected.has(student.username)}
                        onChange={() => toggle(student.username)}
                      />
                      {student.username}
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </fieldset>

        <div>
          <label htmlFor={typedId} className="font-semibold">
            Or type usernames
          </label>
          <PixelInput
            id={typedId}
            className="mt-1"
            value={typed}
            placeholder="maria_s, juan_dc"
            autoComplete="off"
            onChange={(event) => setTyped(event.target.value)}
          />
          <p className="mt-1 text-xs text-px-muted">
            Separate names with commas or spaces.
          </p>
        </div>

        {error ? (
          <p
            role="alert"
            className="border-2 border-danger-dark bg-danger-surface p-2 text-danger-dark"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <PixelButton
            type="button"
            variant="neutral"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </PixelButton>
          <PixelButton type="submit" disabled={saving}>
            {saving ? "Adding..." : "Add students"}
          </PixelButton>
        </div>
      </form>
    </PixelModal>
  );
}
