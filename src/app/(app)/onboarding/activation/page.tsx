import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Stack } from "@/ui";
import { ActivationWizard } from "@/components/onboarding/phase2/ActivationWizard";

export default async function ActivationOnboardingPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) redirect("/dashboard");

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Activation" }]}
        title="Activation & team rollout"
        description="Embed Solvren into your operating model: team, priorities, workflows, approvals, and your first live signal."
      />
      <Suspense fallback={<p className="text-sm text-[color:var(--rg-text-muted)]">Loading…</p>}>
        <Stack gap={4}>
          <ActivationWizard />
        </Stack>
      </Suspense>
    </div>
  );
}
