import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Minimal middleware for Vercel Edge. Auth and verify-pending redirect
 * are enforced in (app) layout and API routes instead, to avoid
 * MIDDLEWARE_INVOCATION_FAILED with @supabase/ssr in Edge.
 */
export async function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  // Empty matcher = middleware never runs (avoids Edge/Supabase failures on Vercel)
  matcher: [],
};
