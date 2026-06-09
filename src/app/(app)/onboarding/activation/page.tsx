import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeaderV2, Stack } from "@/ui";
import { ActivationWizard } from "@/components/onboarding/phase2/ActivationWizard";

export default async function ActivationOnboardingPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) redirect("/dashboard");

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeaderV2
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Setup" }]}
        title="Turn protection on"
        description="Choose what to protect, invite the right people, connect the first workflow, and start seeing risk and value."
      />
      <Suspense fallback={<p className="text-sm text-[var(--text-muted)]">Loading...</p>}>
        <Stack gap={4}>
          <ActivationWizard />
        </Stack>
      </Suspense>
    </div>
  );
}
