import { SearchError } from "./errors";
import { createSearchScope } from "./scope";
import { isInvalidSession } from "../auth/session-errors";
import {
  RoleLookupError,
  type AccountAccess,
} from "../auth/roles";
import type { SearchScope } from "./types";

type AuthError = {
  code?: string;
  message: string;
  name?: string;
  status?: number;
};

type AuthUser = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
};

export type SearchAuthClient = {
  auth: {
    getUser(): Promise<{
      data: { user: AuthUser | null };
      error: AuthError | null;
    }>;
    mfa: {
      getAuthenticatorAssuranceLevel(): Promise<{
        data: { currentLevel: string | null } | null;
        error: AuthError | null;
      }>;
    };
  };
  resolveAccess(user: AuthUser): Promise<AccountAccess>;
};

function unauthenticated(): SearchError {
  return new SearchError(
    401,
    "UNAUTHENTICATED",
    "Sign in to search records.",
  );
}

export async function resolveSearchContext(
  client: SearchAuthClient,
): Promise<SearchScope> {
  const { data: userData, error: userError } =
    await client.auth.getUser();

  if (userError) {
    if (!isInvalidSession(userError)) {
      throw new SearchError(
        503,
        "AUTH_CHECK_FAILED",
        "Unable to verify your sign-in session.",
        { code: userError.code ?? "UNKNOWN" },
      );
    }

    throw unauthenticated();
  }

  if (!userData.user) {
    throw unauthenticated();
  }

  const user = userData.user;
  let access: AccountAccess;

  try {
    access = await client.resolveAccess(user);
  } catch (error) {
    if (error instanceof RoleLookupError) {
      throw new SearchError(
        503,
        "MEMBERSHIP_CHECK_FAILED",
        "Unable to verify account access.",
        { code: error.code },
      );
    }

    throw new SearchError(
      503,
      "AUTH_CHECK_FAILED",
      "Unable to verify your account access.",
    );
  }

  const { data: assurance, error: assuranceError } =
    await client.auth.mfa.getAuthenticatorAssuranceLevel();

  if (assuranceError) {
    throw new SearchError(
      503,
      "SECURITY_LEVEL_UNAVAILABLE",
      "Unable to verify your session security level.",
    );
  }

  const currentLevel = assurance?.currentLevel ?? null;

  if (access.role === "admin") {
    if (access.state !== "active") {
      throw new SearchError(
        403,
        "FORBIDDEN_ROLE",
        "This account is not authorized for admin search.",
      );
    }

    if (currentLevel !== "aal2") {
      throw new SearchError(
        403,
        "MFA_REQUIRED",
        "Admin search requires a verified multi-factor session.",
      );
    }

    return createSearchScope({
      role: "admin",
      userId: user.id,
      displayName: access.displayName,
    });
  }

  if (access.role === "teacher") {
    if (access.state !== "active" || access.teacherId === null) {
      throw new SearchError(
        403,
        "FORBIDDEN_ROLE",
        access.state === "pending"
          ? "Your teacher account is pending administrator approval."
          : "This account is not authorized for teacher search.",
      );
    }

    return createSearchScope({
      role: "teacher",
      userId: user.id,
      teacherId: String(access.teacherId),
      displayName: access.displayName,
    });
  }

  throw new SearchError(
    403,
    "FORBIDDEN_ROLE",
    "This account is not authorized to search records.",
  );
}
