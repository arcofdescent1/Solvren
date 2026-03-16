import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { authStateFromUser } from "@/lib/auth";

function isAllowedForUnverified(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/invite/") ||
    pathname.startsWith("/docs") ||
    pathname === "/how-it-works" ||
    pathname === "/pricing" ||
    pathname === "/for-finance" ||
    pathname === "/for-executives" ||
    pathname === "/for-engineering" ||
    pathname === "/security"
  );
}

export async function middleware(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);
  let res = NextResponse.next({ request: { headers: requestHeaders } });

  // Simple correlation id for debugging pilot issues.
  try {
    const rid = req.headers.get("x-request-id") ?? crypto.randomUUID();
    res.headers.set("x-request-id", rid);
  } catch {
    // non-fatal
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const state = authStateFromUser(user ?? null);

  // Signed-in but unverified: only allow verify-pending, verified, verify-error, callback, login, home
  if (state.isAuthenticated && !state.isVerified) {
    if (!isAllowedForUnverified(req.nextUrl.pathname)) {
      const redirect = new URL("/auth/verify-pending", req.url);
      return NextResponse.redirect(redirect);
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
