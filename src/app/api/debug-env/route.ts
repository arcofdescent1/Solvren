import { NextResponse } from "next/server";

/**
 * Debug route: does the server see Supabase env vars?
 * Safe to call in production (returns only booleans, no secrets).
 * Remove or restrict once debugging is done.
 */
export async function GET() {
  const hasUrl = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  );
  const hasKey = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
  return NextResponse.json({
    serverSees: {
      NEXT_PUBLIC_SUPABASE_URL: hasUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: hasKey,
    },
    hint: !hasUrl || !hasKey
      ? "Server is missing vars. In Vercel: set env for Production, then Redeploy with 'Clear cache and redeploy'."
      : "Server has vars. If client still errors, client bundle may have been built without them (redeploy with cache clear).",
  });
}
