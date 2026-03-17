import { NextResponse } from "next/server";

/**
 * Minimal middleware for Vercel Edge. Auth and verify-pending redirect
 * are enforced in (app) layout and API routes instead, to avoid
 * MIDDLEWARE_INVOCATION_FAILED with @supabase/ssr in Edge.
 */
export async function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
