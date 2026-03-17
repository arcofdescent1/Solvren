import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Minimal middleware: set pathname header for public layout redirect logic.
 * No Supabase; auth is enforced in (app) layout and API routes.
 */
export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
