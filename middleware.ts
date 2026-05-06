import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { isDemoWriteAllowedRequest } from "@/lib/demo/demoWritePolicy";

const ACTIVE_ORG_COOKIE = "rg_active_org";

/**
 * Pathname for layouts + demo read-only (org resolved via active-org cookie; full org in route handlers).
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  supabaseResponse.headers.set("x-pathname", pathname);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url || !key) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const orgId = request.cookies.get(ACTIVE_ORG_COOKIE)?.value?.trim() ?? null;
    if (orgId) {
      const [{ data: org }, { data: cfg }] = await Promise.all([
        supabase.from("organizations").select("is_demo").eq("id", orgId).maybeSingle(),
        supabase.from("org_demo_config").select("is_demo_org").eq("org_id", orgId).maybeSingle(),
      ]);
      const isDemo = Boolean(
        (org as { is_demo?: boolean } | null)?.is_demo || (cfg as { is_demo_org?: boolean } | null)?.is_demo_org
      );
      if (isDemo && !isDemoWriteAllowedRequest(request)) {
        return NextResponse.json({ error: "Demo mode is read-only" }, { status: 403 });
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
