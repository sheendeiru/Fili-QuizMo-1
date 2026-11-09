export type BulkDeleteFailure = { id: string; message: string };

export type BulkDeleteResult = {
  deleted: string[];
  failed: BulkDeleteFailure[];
};

/**
 * Deletes accounts one at a time, in order. A failure never stops the rest, so
 * one student who cannot be deleted does not block the others. Each failure is
 * reported with the server's message so the teacher can see what went wrong.
 */
export async function deleteAccountsOneByOne(
  ids: readonly string[],
  deleteOne: (id: string) => Promise<void>,
): Promise<BulkDeleteResult> {
  const result: BulkDeleteResult = { deleted: [], failed: [] };

  for (const id of new Set(ids)) {
    try {
      await deleteOne(id);
      result.deleted.push(id);
    } catch (error) {
      result.failed.push({
        id,
        message:
          error instanceof Error && error.message
            ? error.message
            : "Unable to delete the account.",
      });
    }
  }

  return result;
}

function studentsLabel(count: number): string {
  return count === 1 ? "1 student" : `${count} students`;
}

/** The message shown after a bulk delete; `kind` picks the success or error style. */
export function summarizeBulkDelete(result: BulkDeleteResult): {
  kind: "success" | "error";
  message: string;
} {
  const { deleted, failed } = result;

  if (failed.length === 0) {
    return { kind: "success", message: `${studentsLabel(deleted.length)} deleted.` };
  }

  const reasons = [...new Set(failed.map((failure) => failure.message))];
  const detail = reasons.slice(0, 2).join(" ");

  if (deleted.length === 0) {
    return {
      kind: "error",
      message: `No students were deleted. ${detail}`,
    };
  }

  return {
    kind: "error",
    message: `${studentsLabel(deleted.length)} deleted, but ${failed.length} could not be deleted and ${failed.length === 1 ? "is" : "are"} still selected. ${detail}`,
  };
}
