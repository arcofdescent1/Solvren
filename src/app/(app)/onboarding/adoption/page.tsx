import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeaderV2, Stack } from "@/ui";
import { AdoptionWizard } from "@/components/onboarding/phase3/AdoptionWizard";

export default async function AdoptionOnboardingPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) redirect("/dashboard");

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeaderV2
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Setup" }]}
        title="Get teams using Solvren"
        description="Expand coverage, invite decision makers, show leaders the value protected, and create a simple weekly rhythm."
      />
      <Suspense fallback={<p className="text-sm text-[var(--text-muted)]">Loading...</p>}>
        <Stack gap={4}>
          <AdoptionWizard />
        </Stack>
      </Suspense>
    </div>
  );
}
