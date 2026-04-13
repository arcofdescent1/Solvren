import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authStateFromUser } from "@/lib/auth";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { shouldRedirectToGuidedOnboarding } from "@/lib/onboarding/guidedPhase1Gate";
import { shouldRedirectToPhase2Activation } from "@/lib/onboarding/phase2Gate";
import { AppShell } from "@/ui/layout/app-shell";

export const runtime = "nodejs";

/**
 * App route layout: auth guard + app shell (top nav, side nav, footer links).
 * Unauthenticated users redirect to login.
 * Unverified users redirect to verify-pending.
 * Legal/support links are rendered by `AppFooter` inside `AppShellClient`.
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

  const { activeOrgId } = await getActiveOrg(supabase, data.user!.id);
  if (activeOrgId) {
    const pathname = (await headers()).get("x-pathname") ?? "";
    const { data: orgFlags } = await supabase
      .from("organizations")
      .select("is_demo")
      .eq("id", activeOrgId)
      .maybeSingle();
    const isDemoWorkspace = Boolean((orgFlags as { is_demo?: boolean } | null)?.is_demo);
    if (
      !isDemoWorkspace &&
      pathname &&
      (await shouldRedirectToGuidedOnboarding(supabase, activeOrgId, pathname))
    ) {
      redirect("/onboarding");
    }
    if (
      !isDemoWorkspace &&
      pathname &&
      (await shouldRedirectToPhase2Activation(supabase, activeOrgId, pathname))
    ) {
      redirect("/onboarding/activation");
    }
  }

  return <AppShell>{children}</AppShell>;
}
