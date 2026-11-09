import {
  errorResponse,
  isUuid,
  proxyTeacherRequest,
  readJsonBody,
} from "@/lib/classes/backend";

/** Adds students to a class by username. Any unknown username rejects all. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ classId: string }> },
): Promise<Response> {
  const { classId } = await params;
  if (!isUuid(classId)) {
    return errorResponse(422, "INVALID_REQUEST", "Invalid class.");
  }

  const body = await readJsonBody(request);
  if (body instanceof Response) return body;

  const { usernames } = body;
  if (
    !Array.isArray(usernames) ||
    !usernames.every((name) => typeof name === "string")
  ) {
    return errorResponse(
      422,
      "INVALID_REQUEST",
      "Enter at least one student username.",
    );
  }

  return proxyTeacherRequest({
    method: "POST",
    path: `/teacher/classes/${classId}/students`,
    body: { usernames },
  });
}
