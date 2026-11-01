import { createClient } from "@/lib/supabase/server";
import { SearchError, isSearchError } from "@/lib/search/errors";
import { resolveSearchContext } from "@/lib/search/auth";
import type { SearchAuthClient } from "@/lib/search/auth";
import {
  createAccountRoleLookup,
  resolveAccountAccess,
} from "@/lib/auth/roles";
import { getSearchDataSource, createSearchRepository } from "@/lib/search/runtime";
import { executeSearch } from "@/lib/search/service";
import { parseSearchQuery } from "@/lib/search/validation";

function errorResponse(error: SearchError): Response {
  return Response.json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    },
    {
      status: error.status,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;

  try {
    const supabase = await createClient();
    const authClient: SearchAuthClient = {
      auth: {
        getUser: () => supabase.auth.getUser(),
        mfa: {
          getAuthenticatorAssuranceLevel: () =>
            supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        },
      },
      resolveAccess: (user) =>
        resolveAccountAccess(createAccountRoleLookup(supabase), user),
    };
    const context = await resolveSearchContext(authClient);
    const query = parseSearchQuery(params, context.role);
    const repository = createSearchRepository({
      dataSource: getSearchDataSource(),
      supabase,
      scope: context,
    });
    const results = await executeSearch({
      context,
      query,
      repository,
    });

    return Response.json(results, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (isSearchError(error)) {
      return errorResponse(error);
    }

    console.error("Search API request failed.", error);
    return errorResponse(
      new SearchError(
        500,
        "SEARCH_REQUEST_FAILED",
        "Unable to load search results.",
      ),
    );
  }
}
