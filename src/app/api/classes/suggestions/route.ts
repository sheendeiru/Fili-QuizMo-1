import { proxyTeacherRequest } from "@/lib/classes/backend";

/** Student accounts worth suggesting when filling a class (no emails). */
export async function GET(): Promise<Response> {
  return proxyTeacherRequest({ method: "GET", path: "/teacher/students" });
}
