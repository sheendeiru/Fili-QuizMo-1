import { createClient } from "@/lib/supabase/server";
import { createAccountRoleLookup, resolveAccountAccess } from "@/lib/auth/roles";
import { isInvalidSession } from "@/lib/auth/session-errors";
import { backendBaseUrl, errorResponse } from "@/lib/classes/backend";
import { parseAchievements } from "@/lib/dashboard/achievements";

/** The backend derives identity from the student's token, never a supplied ID. */
export async function GET(): Promise<Response> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error && !isInvalidSession(error)) throw error;
    if (!user) return errorResponse(401, "UNAUTHENTICATED", "Sign in to view achievements.");
    const access = await resolveAccountAccess(createAccountRoleLookup(supabase), user);
    if (access.state !== "active" || access.role !== "student") {
      return errorResponse(403, "FORBIDDEN_ROLE", "Student account required.");
    }
    const baseUrl = backendBaseUrl();
    if (!baseUrl) return errorResponse(503, "BACKEND_NOT_CONFIGURED", "Achievements are unavailable. Please retry later.");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return errorResponse(401, "UNAUTHENTICATED", "Sign in to view achievements.");
    const response = await fetch(`${baseUrl}/student-achievements`, {
      headers: { Authorization: `Bearer ${session.access_token}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      return errorResponse([401, 403].includes(response.status) ? response.status : 503, "ACHIEVEMENTS_UNAVAILABLE", "Achievements could not sync. Please retry.");
    }
    const data: unknown = await response.json();
    parseAchievements(data);
    return Response.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return errorResponse(503, "ACHIEVEMENTS_UNAVAILABLE", "Achievements could not sync. Please retry.");
  }
}

