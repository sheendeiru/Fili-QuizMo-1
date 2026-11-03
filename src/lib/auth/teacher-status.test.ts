import { describe, expect, it } from "vitest";
import { parseTeacherStatusUpdate } from "./teacher-status";

describe("parseTeacherStatusUpdate", () => {
  it("accepts the three admin-managed statuses", () => {
    expect(
      parseTeacherStatusUpdate({ teacherId: 4, status: "approved" }),
    ).toEqual({ teacherId: 4, status: "approved" });
    expect(
      parseTeacherStatusUpdate({ teacherId: 4, status: "rejected" }),
    ).toEqual({ teacherId: 4, status: "rejected" });
    expect(
      parseTeacherStatusUpdate({ teacherId: 4, status: "suspended" }),
    ).toEqual({ teacherId: 4, status: "suspended" });
  });

  it("rejects self-approval through the pending status", () => {
    expect(
      parseTeacherStatusUpdate({ teacherId: 4, status: "pending" }),
    ).toBeNull();
  });

  it("rejects malformed teacher ids and bodies", () => {
    expect(
      parseTeacherStatusUpdate({ teacherId: "4", status: "approved" }),
    ).toBeNull();
    expect(
      parseTeacherStatusUpdate({ teacherId: 0, status: "approved" }),
    ).toBeNull();
    expect(
      parseTeacherStatusUpdate({ teacherId: 4.5, status: "approved" }),
    ).toBeNull();
    expect(parseTeacherStatusUpdate(null)).toBeNull();
    expect(parseTeacherStatusUpdate({ status: "approved" })).toBeNull();
  });
});
