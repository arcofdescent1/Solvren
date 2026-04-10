import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authStateFromUser } from "@/lib/auth";
import { PublicShell } from "@/components/layout/PublicShell";

export const runtime = "nodejs";

/**
 * Public route layout: marketing header + footer only.
 * No app sidebar or top nav. Used for /, /login, /pricing, /auth/*, etc.
 * Authenticated+verified users redirect to /dashboard except on auth flows (e.g. reset-password).
 */
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  const state = authStateFromUser(data.user ?? null);

  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";

  const isAuthFlow = pathname.startsWith("/auth/reset-password");
  const isSignupFlow = pathname === "/signup" || pathname.startsWith("/signup/");
  const isPublicMarketingContentPath =
    pathname.startsWith("/legal/") ||
    pathname.startsWith("/platform") ||
    pathname === "/contact" ||
    pathname === "/about" ||
    pathname === "/careers" ||
    pathname === "/support" ||
    pathname === "/status" ||
    pathname === "/trust";
  if (
    state.isAuthenticated &&
    state.isVerified &&
    !isAuthFlow &&
    !isSignupFlow &&
    !isPublicMarketingContentPath
  ) {
    redirect("/dashboard");
  }

  return <PublicShell>{children}</PublicShell>;
}
