import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authStateFromUser } from "@/lib/auth";
import { LandingPage } from "@/components/marketing/pages/LandingPage";

/**
 * Root path behavior:
 * - unauthenticated → marketing landing page
 * - authenticated but unverified → /auth/verify-pending
 * - authenticated and verified → redirect to /dashboard (never remain on marketing)
 */
export default async function PublicHomePage() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  const state = authStateFromUser(data.user ?? null);

  if (state.isAuthenticated && !state.isVerified) {
    redirect("/auth/verify-pending");
  }

  if (state.isAuthenticated && state.isVerified) {
    redirect("/dashboard");
  }

  return <LandingPage noShell />;
}
