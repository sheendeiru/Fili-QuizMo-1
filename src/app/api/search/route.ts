import { createClient } from "@/lib/supabase/server";
import { loadTeacherClasses } from "@/lib/classes/server";
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
    // The class filter narrows to the usernames in one of this teacher's own
    // classes. The backend only returns the signed-in teacher's classes, so a
    // class id that is not theirs is simply "not found".
    let classUsernames: string[] | undefined;
    if (query.class) {
      const classes = await loadTeacherClasses();
      if (!classes) {
        throw new SearchError(
          503,
          "CLASSES_UNAVAILABLE",
          "Classes are not available right now. Clear the class filter or try again.",
        );
      }

      const selected = classes.find((item) => item.classId === query.class);
      if (!selected) {
        throw new SearchError(
          404,
          "CLASS_NOT_FOUND",
          "That class was not found. It may have been deleted.",
        );
      }

      classUsernames = selected.students.map((student) => student.username);
    }

    const results = await executeSearch({
      context,
      query,
      repository,
      classUsernames,
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
