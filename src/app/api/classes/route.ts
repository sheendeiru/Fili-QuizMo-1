import {
  errorResponse,
  proxyTeacherRequest,
  readJsonBody,
} from "@/lib/classes/backend";

// The teacher's classes with their students. The quiz backend owns the data
// (see ocr-backend/CLASS_PUBLISHING.md); these routes only check the teacher
// and forward the request.

export async function GET(): Promise<Response> {
  return proxyTeacherRequest({ method: "GET", path: "/teacher/classes" });
}

export async function POST(request: Request): Promise<Response> {
  const body = await readJsonBody(request);
  if (body instanceof Response) return body;

  if (typeof body.name !== "string") {
    return errorResponse(422, "INVALID_REQUEST", "Please enter a class name.");
  }

  return proxyTeacherRequest({
    method: "POST",
    path: "/teacher/classes",
    body: { name: body.name },
  });
}
