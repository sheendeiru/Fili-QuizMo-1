import {
  errorResponse,
  isUuid,
  proxyTeacherRequest,
} from "@/lib/classes/backend";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ classId: string; studentId: string }> },
): Promise<Response> {
  const { classId, studentId } = await params;
  if (!isUuid(classId) || !isUuid(studentId)) {
    return errorResponse(422, "INVALID_REQUEST", "Invalid class or student.");
  }

  return proxyTeacherRequest({
    method: "DELETE",
    path: `/teacher/classes/${classId}/students/${studentId}`,
  });
}
