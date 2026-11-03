export function safeInternalPath(
  value: string | null | undefined,
): string | null {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[a-z][a-z\d+.-]*:/i.test(value) ||
    /[\u0000-\u001f]/.test(value)
  ) {
    return null;
  }

  try {
    const parsed = new URL(value, "https://fili-quizmo.invalid");
    return parsed.origin === "https://fili-quizmo.invalid" ? value : null;
  } catch {
    return null;
  }
}
