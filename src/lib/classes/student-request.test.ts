import { expect, it } from "vitest";
import { readStudentResponse } from "./student-request";

it("shows configuration guidance instead of a generic sync error", async () => {
  await expect(readStudentResponse(Response.json({
    error: { code: "BACKEND_NOT_CONFIGURED", message: "The quiz server connection is not configured. Contact the administrator." },
  }, { status: 503 }))).rejects.toThrow("not configured");
});

it("asks the student to sign in again for an expired session", async () => {
  await expect(readStudentResponse(Response.json({}, { status: 401 }))).rejects.toThrow("sign in again");
});

it("preserves a genuinely empty quiz list", async () => {
  await expect(readStudentResponse(Response.json({ quizzes: [] }))).resolves.toEqual({ quizzes: [] });
});
