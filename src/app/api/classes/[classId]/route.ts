import {
  errorResponse,
  isUuid,
  proxyTeacherRequest,
  readJsonBody,
} from "@/lib/classes/backend";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ classId: string }> },
): Promise<Response> {
  const { classId } = await params;
  if (!isUuid(classId)) {
    return errorResponse(422, "INVALID_REQUEST", "Invalid class.");
  }

  const body = await readJsonBody(request);
  if (body instanceof Response) return body;

  if (typeof body.name !== "string") {
    return errorResponse(422, "INVALID_REQUEST", "Please enter a class name.");
  }

  return proxyTeacherRequest({
    method: "PATCH",
    path: `/teacher/classes/${classId}`,
    body: { name: body.name },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ classId: string }> },
): Promise<Response> {
  const { classId } = await params;
  if (!isUuid(classId)) {
    return errorResponse(422, "INVALID_REQUEST", "Invalid class.");
  }

  return proxyTeacherRequest({
    method: "DELETE",
    path: `/teacher/classes/${classId}`,
  });
}
