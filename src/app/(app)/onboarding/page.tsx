/**
 * Phase 10 — Onboarding wizard page.
 */
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader } from "@/ui";
import { OnboardingWizard } from "@/components/onboarding";

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) redirect("/dashboard");

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Onboarding" }]}
        title="Onboarding"
        description="Complete setup to reach your first value"
      />
      <OnboardingWizard />
    </div>
  );
}
