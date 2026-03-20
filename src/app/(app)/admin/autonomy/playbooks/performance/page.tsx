/**
 * Phase 10 — Playbook performance dashboard page.
 */
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Stack } from "@/ui";
import { PlaybookPerformanceDashboard } from "@/components/onboarding";

export default async function PlaybookPerformancePage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  if (!activeOrgId || !membership) redirect("/dashboard");

  return (
    <Stack gap={6} className="max-w-5xl">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin/domains" },
          { label: "Playbook Performance" },
        ]}
        title="Playbook Performance"
        description="View health, outcomes, and effectiveness of enabled playbooks"
      />
      <PlaybookPerformanceDashboard />
    </Stack>
  );
}
