// Set ALLOWED_ORIGIN (supabase secrets set ALLOWED_ORIGIN=https://your-app.com)
// in production. "*" is only a development fallback.
export const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
