export const TEACHER_STATUS_UPDATES = [
  "approved",
  "rejected",
  "suspended",
] as const;

export type TeacherStatusUpdate = (typeof TEACHER_STATUS_UPDATES)[number];

export type TeacherStatusUpdateInput = {
  teacherId: number;
  status: TeacherStatusUpdate;
};

export function isTeacherStatusUpdate(
  value: unknown,
): value is TeacherStatusUpdate {
  return (
    typeof value === "string" &&
    (TEACHER_STATUS_UPDATES as readonly string[]).includes(value)
  );
}

export function parseTeacherStatusUpdate(
  body: unknown,
): TeacherStatusUpdateInput | null {
  if (typeof body !== "object" || body === null) {
    return null;
  }

  const { teacherId, status } = body as {
    teacherId?: unknown;
    status?: unknown;
  };

  if (
    typeof teacherId !== "number" ||
    !Number.isSafeInteger(teacherId) ||
    teacherId <= 0
  ) {
    return null;
  }

  if (!isTeacherStatusUpdate(status)) {
    return null;
  }

  return { teacherId, status };
}
