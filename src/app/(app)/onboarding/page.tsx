import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeaderV2 } from "@/ui";
import { Phase5OnboardingWizard } from "@/components/onboarding/Phase5OnboardingWizard";

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) redirect("/home");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeaderV2
        breadcrumbs={[{ label: "Setup", href: "/integrations" }, { label: "Guided setup" }]}
        title="Guided setup"
        description="Connect a system, choose what to protect, invite decision makers, and see your first revenue-risk signal."
        helper="You can come back to the full Setup page anytime for advanced controls."
      />
      <Suspense fallback={<p className="text-sm text-[var(--text-muted)]">Loading setup...</p>}>
        <Phase5OnboardingWizard />
      </Suspense>
    </div>
  );
}
