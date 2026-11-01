import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isInvalidSession } from "@/lib/auth/session-errors";
import {
  createAccountRoleLookup,
  dashboardPathForRole,
  loginPathForRole,
  resolveAccountAccess,
  type AccountRole,
} from "@/lib/auth/roles";
import { getSupabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/types/database.types";

type DashboardRoute = {
  prefix: string;
  role: AccountRole;
  loginPath: string;
};

const DASHBOARD_ROUTES: DashboardRoute[] = [
  {
    prefix: "/admin-dashboard",
    role: "admin",
    loginPath: "/admin-login",
  },
  {
    prefix: "/teacher-dashboard",
    role: "teacher",
    loginPath: "/teacher-login",
  },
  {
    prefix: "/student-dashboard",
    role: "student",
    loginPath: "/student-login",
  },
];

function matchDashboardRoute(pathname: string): DashboardRoute | null {
  return (
    DASHBOARD_ROUTES.find(
      (route) =>
        pathname === route.prefix ||
        pathname.startsWith(`${route.prefix}/`),
    ) ?? null
  );
}

function redirectWithCookies(
  request: NextRequest,
  response: NextResponse,
  path: string,
): NextResponse {
  const redirectResponse = NextResponse.redirect(
    new URL(path, request.url),
  );
  redirectResponse.headers.set(
    "Cache-Control",
    "private, no-store, max-age=0",
  );

  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  const { url, publishableKey } = getSupabaseConfig();
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      },
    },
  });

  const { data: claimsData, error } = await supabase.auth.getClaims();

  if (error && !isInvalidSession(error)) {
    throw error;
  }

  const pathname = request.nextUrl.pathname;
  const dashboardRoute = matchDashboardRoute(pathname);
  const isProfileCompletion =
    pathname === "/complete-profile" ||
    pathname.startsWith("/complete-profile/");
  const isLoginPage =
    pathname === "/admin-login" ||
    pathname === "/teacher-login" ||
    pathname === "/student-login";

  if (!dashboardRoute && !isProfileCompletion && !isLoginPage) {
    return response;
  }

  response.headers.set("Cache-Control", "private, no-store, max-age=0");

  const claims = claimsData?.claims ?? null;

  if (!claims) {
    if (isLoginPage) {
      return response;
    }

    if (dashboardRoute) {
      return redirectWithCookies(request, response, "/");
    }

    return redirectWithCookies(
      request,
      response,
      "/signup?status=session_expired",
    );
  }

  if (isProfileCompletion) {
    return response;
  }

  if (!dashboardRoute) {
    return response;
  }

  let access;

  try {
    access = await resolveAccountAccess(
      createAccountRoleLookup(supabase),
      { id: claims.sub, email: claims.email ?? null },
    );
  } catch (lookupError) {
    console.error("Dashboard role lookup failed.", lookupError);
    return redirectWithCookies(
      request,
      response,
      `${dashboardRoute.loginPath}?status=unavailable`,
    );
  }

  if (access.state === "unregistered") {
    return redirectWithCookies(
      request,
      response,
      "/complete-profile",
    );
  }

  if (access.state !== "active") {
    return redirectWithCookies(
      request,
      response,
      `${loginPathForRole(access.role)}?status=${access.state}`,
    );
  }

  if (!access.role || access.role !== dashboardRoute.role) {
    const destination = access.role
      ? dashboardPathForRole(access.role)
      : `${dashboardRoute.loginPath}?status=forbidden`;

    return redirectWithCookies(request, response, destination);
  }

  if (
    dashboardRoute.role === "admin" &&
    claims.aal !== "aal2"
  ) {
    return redirectWithCookies(
      request,
      response,
      "/admin-login?mfa=required",
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/admin-login",
    "/admin-dashboard/:path*",
    "/teacher-login",
    "/teacher-dashboard/:path*",
    "/student-login",
    "/student-dashboard/:path*",
    "/complete-profile",
  ],
};
