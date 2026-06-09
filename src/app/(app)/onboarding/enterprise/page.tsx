import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeaderV2, Stack } from "@/ui";
import { EnterpriseExpansionCenter } from "@/components/onboarding/phase4/EnterpriseExpansionCenter";

export default async function EnterpriseOnboardingPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) redirect("/dashboard");

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeaderV2
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Setup" }]}
        title="Scale Solvren across the business"
        description="Extend protection to more teams, keep leaders aligned, and prove the value Solvren is protecting before renewal."
      />
      <Suspense fallback={<p className="text-sm text-[var(--text-muted)]">Loading...</p>}>
        <Stack gap={4}>
          <EnterpriseExpansionCenter />
        </Stack>
      </Suspense>
    </div>
  );
}
