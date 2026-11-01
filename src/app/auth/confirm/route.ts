import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { ensureAccountProfile } from "@/lib/auth/provisioning";
import { createClient } from "@/lib/supabase/server";

function redirectTo(
  request: NextRequest,
  path: string,
): NextResponse {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const linkError =
    url.searchParams.get("error_description") ??
    url.searchParams.get("error");
  const supabase = await createClient();

  if (linkError) {
    return redirectTo(request, "/auth/error");
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (error) {
      console.error("Email confirmation failed.", error.message);
      return redirectTo(request, "/auth/error");
    }
  } else if (code) {
    const { error } =
      await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Email confirmation code exchange failed.", error.message);
      return redirectTo(request, "/auth/error");
    }
  } else {
    return redirectTo(request, "/auth/error");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return redirectTo(request, "/auth/error");
  }

  try {
    const result = await ensureAccountProfile(supabase, user);

    if (!result.ok) {
      const reason =
        result.code === "username_taken"
          ? "username_taken"
          : "profile_error";

      return redirectTo(
        request,
        `/complete-profile?reason=${reason}`,
      );
    }

    return redirectTo(request, result.destination);
  } catch (error) {
    console.error("Profile setup after confirmation failed.", error);
    return redirectTo(
      request,
      "/complete-profile?reason=profile_error",
    );
  }
}
