/** Only expose messages produced by our own student API, never upstream bodies. */
export async function readStudentResponse(response: Response): Promise<unknown> {
  const body: unknown = await response.json();
  if (response.ok) return body;
  if (response.status === 401) throw new Error("Your session expired. Please sign in again.");
  if (response.status === 403) throw new Error("Please sign in with a student account.");
  const error = body && typeof body === "object" && "error" in body ? body.error : null;
  const message = error && typeof error === "object" && "message" in error ? error.message : null;
  throw new Error(typeof message === "string" ? message : "Your data could not be loaded. Please retry.");
}
