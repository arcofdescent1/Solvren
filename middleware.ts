import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

/** Inlined so middleware has no Edge-unsafe imports (e.g. from @/lib/auth). */
function isVerified(user: { email_confirmed_at?: string | null } | null): boolean {
  if (!user) return false;
  const at = user.email_confirmed_at;
  return at != null && at !== "";
}

export async function middleware(req: NextRequest) {
  try {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-pathname", req.nextUrl.pathname);
    const res = NextResponse.next({ request: { headers: requestHeaders } });

    try {
      const rid = req.headers.get("x-request-id") ?? crypto.randomUUID();
      res.headers.set("x-request-id", rid);
    } catch {
      /* non-fatal */
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) return res;

    const { createServerClient } = await import("@supabase/ssr");
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();
    const authenticated = user != null;
    const verified = isVerified(user ?? null);

    if (authenticated && !verified && !isAllowedForUnverified(req.nextUrl.pathname)) {
      return NextResponse.redirect(new URL("/auth/verify-pending", req.url));
    }

    return res;
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
