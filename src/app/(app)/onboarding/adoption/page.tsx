import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Stack } from "@/ui";
import { AdoptionWizard } from "@/components/onboarding/phase3/AdoptionWizard";

export default async function AdoptionOnboardingPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) redirect("/dashboard");

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Adoption" }]}
        title="Adoption & Executive Value"
        description="Expand coverage, invite cross-functional teams, put Solvren in front of executives, prove ROI from real stories, and build a weekly operating rhythm."
      />
      <Suspense fallback={<p className="text-sm text-[color:var(--rg-text-muted)]">Loading…</p>}>
        <Stack gap={4}>
          <AdoptionWizard />
        </Stack>
      </Suspense>
    </div>
  );
}
