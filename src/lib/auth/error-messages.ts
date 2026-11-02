const DEFAULT_INVALID_CREDENTIALS = "Invalid email or password.";

export function friendlyLoginError(message: string): string {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("email not confirmed") ||
    normalized.includes("email not verified")
  ) {
    return "Confirm your email address before signing in. Check your inbox for the confirmation link.";
  }

  if (normalized.includes("invalid login credentials")) {
    return DEFAULT_INVALID_CREDENTIALS;
  }

  if (
    normalized.includes("rate limit") ||
    normalized.includes("too many requests")
  ) {
    return "Too many sign-in attempts. Wait a moment and try again.";
  }

  return message;
}
