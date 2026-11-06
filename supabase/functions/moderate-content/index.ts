
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (
  body: Record<string, unknown>,
  status = 200,
) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
};

function getDefaultKey(name: string): string | undefined {
  const raw = Deno.env.get(name);

  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw);
    return parsed.default ?? undefined;
  } catch {
    return raw;
  }
}

const severeCategories = [
  "sexual",
  "sexual/minors",
  "harassment/threatening",
  "hate/threatening",
  "illicit/violent",
  "self-harm/instructions",
  "violence/graphic",
];

const REVIEW_THRESHOLD = 0.35;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { error: "Method not allowed." },
      405,
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(
        { error: "Authentication required." },
        401,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    const publishableKey =
      getDefaultKey("SUPABASE_PUBLISHABLE_KEYS") ??
      Deno.env.get("SUPABASE_ANON_KEY") ??
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

    const secretKey =
      getDefaultKey("SUPABASE_SECRET_KEYS") ??
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (
      !supabaseUrl ||
      !publishableKey ||
      !secretKey ||
      !openaiKey
    ) {
      return jsonResponse(
        { error: "Server configuration is incomplete." },
        500,
      );
    }

    // Authenticate the actual caller.
    const userClient = createClient(
      supabaseUrl,
      publishableKey,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return jsonResponse(
        { error: "Invalid or expired session." },
        401,
      );
    }

    const body = await req.json();

    const {
      text,
      contentType = "general",
    } = body;

    if (
      typeof text !== "string" ||
      !text.trim() ||
      text.length > 10000
    ) {
      return jsonResponse(
        { error: "Invalid content. Maximum length is 10,000 characters." },
        400,
      );
    }

    const allowedTypes = [
      "quiz_title",
      "quiz_description",
      "question",
      "answer",
      "student_answer",
      "username",
      "announcement",
      "general",
    ];

    if (!allowedTypes.includes(contentType)) {
      return jsonResponse(
        { error: "Invalid content type." },
        400,
      );
    }

    // Call OpenAI Moderation API.
    const moderationResponse = await fetch(
      "https://api.openai.com/v1/moderations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "omni-moderation-latest",
          input: text,
        }),
      },
    );

    if (!moderationResponse.ok) {
      return jsonResponse(
        {
          error: "Moderation service unavailable.",
          retryable: true,
        },
        503,
      );
    }

    const moderationData = await moderationResponse.json();

    const result = moderationData.results?.[0];

    if (!result) {
      return jsonResponse(
        { error: "Invalid moderation response." },
        502,
      );
    }

    const categories = result.categories ?? {};
    const scores = result.category_scores ?? {};

    const severeViolation = severeCategories.some(
      (category) => categories[category] === true,
    );

    const needsReview =
      result.flagged ||
      Object.values(scores).some(
        (score) =>
          typeof score === "number" &&
          score >= REVIEW_THRESHOLD,
      );

    let decision: "allow" | "review" | "block";

    if (severeViolation) {
      decision = "block";
    } else if (needsReview) {
      decision = "review";
    } else {
      decision = "allow";
    }

    // Use the service key only for trusted server-side queue writes.
    const adminClient = createClient(
      supabaseUrl,
      secretKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    if (decision === "review") {
      // Do not retain the submitted text for the sexual/minors
      // category. It is not a CSAM detection or handling system.
      const sensitiveMinorFlag =
        categories["sexual/minors"] === true;

      const { error: queueError } = await adminClient
        .from("moderation_reviews")
        .insert({
          user_id: user.id,
          content_type: contentType,
          content: sensitiveMinorFlag ? null : text,
          decision: "review",
          categories,
          category_scores: scores,
          status: "pending",
        });

      if (queueError) {
        console.error(
          "Moderation queue insertion failed:",
          queueError.message,
        );

        // Fail closed: never approve content if the review
        // process could not be recorded.
        return jsonResponse(
          {
            decision: "block",
            message: "Content could not be submitted for review.",
          },
          503,
        );
      }
    }

    return jsonResponse({
      decision,
      categories,
      message:
        decision === "allow"
          ? "Content passed moderation."
          : decision === "review"
            ? "Content requires administrator review."
            : "Content was blocked.",
    });
  } catch (error) {
    console.error(
      "Moderation function error:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return jsonResponse(
      { error: "Internal moderation error." },
      500,
    );
  }
});


