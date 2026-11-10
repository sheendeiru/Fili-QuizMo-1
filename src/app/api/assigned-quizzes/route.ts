import { studentDataResponse } from "@/lib/classes/student-data";

export async function GET(): Promise<Response> {
  return studentDataResponse("quizzes");
}
