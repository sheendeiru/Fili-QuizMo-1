import {
  ensureAccountProfile,
} from "@/lib/auth/provisioning";
import { RoleLookupError } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

type ProfileRequestBody = {
  role?: unknown;
  username?: unknown;
};

function errorResponse(
  status: number,
  code: string,
  message: string,
): Response {
  return Response.json(
    { error: { code, message } },
    {
      status,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return errorResponse(
      401,
      "UNAUTHENTICATED",
      "Sign in to finish setting up your profile.",
    );
  }

  let body: ProfileRequestBody = {};

  try {
    body = (await request.json()) as ProfileRequestBody;
  } catch {
    // An empty body is valid: role and username can come from user metadata.
  }

  const role =
    body.role === "student" || body.role === "teacher"
      ? body.role
      : null;
  const username =
    typeof body.username === "string"
      ? body.username.trim()
      : null;

  try {
    const result = await ensureAccountProfile(supabase, user, {
      role,
      username,
    });

    if (!result.ok) {
      const status =
        result.code === "username_taken"
          ? 409
          : result.code === "invalid_role" ||
              result.code === "invalid_username"
            ? 400
            : 500;

      return errorResponse(status, result.code, result.message);
    }

    return Response.json(
      {
        destination: result.destination,
        role: result.access.role,
        state: result.access.state,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof RoleLookupError) {
      return errorResponse(
        503,
        error.code,
        "We could not verify your account access. Please try again.",
      );
    }

    console.error("Profile provisioning failed.", error);
    return errorResponse(
      500,
      "PROFILE_SETUP_FAILED",
      "Your profile could not be set up. Please try again.",
    );
  }
}
