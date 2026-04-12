import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Stack } from "@/ui";
import { EnterpriseExpansionCenter } from "@/components/onboarding/phase4/EnterpriseExpansionCenter";

export default async function EnterpriseOnboardingPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) redirect("/dashboard");

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Enterprise expansion" }]}
        title="Enterprise expansion &amp; renewal readiness"
        description="A guided maturity center for widening Solvren across the business, deepening integrations, sustaining executive cadence, and proving renewal-ready value."
      />
      <Suspense fallback={<p className="text-sm text-[color:var(--rg-text-muted)]">Loading…</p>}>
        <Stack gap={4}>
          <EnterpriseExpansionCenter />
        </Stack>
      </Suspense>
    </div>
  );
}
