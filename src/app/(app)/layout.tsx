import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authStateFromUser } from "@/lib/auth";
import { AppShell } from "@/ui/layout/app-shell";

export const runtime = "nodejs";

/**
 * App route layout: auth guard + app shell (top nav, side nav).
 * Unauthenticated users redirect to login.
 * Unverified users redirect to verify-pending.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  const state = authStateFromUser(data.user ?? null);

  if (!state.isAuthenticated) {
    redirect("/login");
  }

  if (!state.isVerified) {
    redirect("/auth/verify-pending");
  }

  return <AppShell>{children}</AppShell>;
}
