import { describe, expect, it, vi } from "vitest";
import {
  deleteAccountsOneByOne,
  summarizeBulkDelete,
} from "./bulk-delete";

describe("deleteAccountsOneByOne", () => {
  it("deletes every selected account, in order", async () => {
    const order: string[] = [];
    const result = await deleteAccountsOneByOne(["a", "b", "c"], async (id) => {
      order.push(id);
    });

    expect(order).toEqual(["a", "b", "c"]);
    expect(result).toEqual({ deleted: ["a", "b", "c"], failed: [] });
  });

  it("keeps going after a failure and reports it with the server's message", async () => {
    const deleteOne = vi.fn(async (id: string) => {
      if (id === "b") throw new Error("You can only manage your own students.");
    });

    const result = await deleteAccountsOneByOne(["a", "b", "c"], deleteOne);

    expect(deleteOne).toHaveBeenCalledTimes(3);
    expect(result.deleted).toEqual(["a", "c"]);
    expect(result.failed).toEqual([
      { id: "b", message: "You can only manage your own students." },
    ]);
  });

  it("falls back to a generic message for errors without one", async () => {
    const result = await deleteAccountsOneByOne(["a", "b"], async (id) => {
      if (id === "a") throw new Error("");
      throw "plain string";
    });

    expect(result.failed.map((failure) => failure.message)).toEqual([
      "Unable to delete the account.",
      "Unable to delete the account.",
    ]);
  });

  it("never deletes the same account twice", async () => {
    const deleteOne = vi.fn(async () => undefined);

    const result = await deleteAccountsOneByOne(["a", "a", "b"], deleteOne);

    expect(deleteOne).toHaveBeenCalledTimes(2);
    expect(result.deleted).toEqual(["a", "b"]);
  });

  it("does nothing for an empty selection", async () => {
    const deleteOne = vi.fn(async () => undefined);

    expect(await deleteAccountsOneByOne([], deleteOne)).toEqual({
      deleted: [],
      failed: [],
    });
    expect(deleteOne).not.toHaveBeenCalled();
  });

  it("waits for each deletion before starting the next", async () => {
    let running = 0;
    let peak = 0;

    await deleteAccountsOneByOne(["a", "b", "c"], async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 1));
      running -= 1;
    });

    expect(peak).toBe(1);
  });
});

describe("summarizeBulkDelete", () => {
  it("reports full success, singular and plural", () => {
    expect(summarizeBulkDelete({ deleted: ["a"], failed: [] })).toEqual({
      kind: "success",
      message: "1 student deleted.",
    });
    expect(summarizeBulkDelete({ deleted: ["a", "b", "c"], failed: [] })).toEqual({
      kind: "success",
      message: "3 students deleted.",
    });
  });

  it("explains a partial failure and that the failed ones stay selected", () => {
    const summary = summarizeBulkDelete({
      deleted: ["a", "b"],
      failed: [{ id: "c", message: "Student not found." }],
    });

    expect(summary.kind).toBe("error");
    expect(summary.message).toBe(
      "2 students deleted, but 1 could not be deleted and is still selected. Student not found.",
    );
  });

  it("says so when nothing was deleted, repeating each reason once", () => {
    const summary = summarizeBulkDelete({
      deleted: [],
      failed: [
        { id: "a", message: "Forbidden." },
        { id: "b", message: "Forbidden." },
      ],
    });

    expect(summary).toEqual({
      kind: "error",
      message: "No students were deleted. Forbidden.",
    });
  });

  it("uses the plural form for several failures", () => {
    const summary = summarizeBulkDelete({
      deleted: ["a"],
      failed: [
        { id: "b", message: "One." },
        { id: "c", message: "Two." },
        { id: "d", message: "Three." },
      ],
    });

    expect(summary.message).toContain("3 could not be deleted and are still selected.");
    expect(summary.message.endsWith("One. Two.")).toBe(true);
  });
});
