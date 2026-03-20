/**
 * Phase 10 — Playbook performance detail page.
 */
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader } from "@/ui";
import { PlaybookPerformanceDetailClient } from "./PlaybookPerformanceDetailClient";

export default async function PlaybookPerformanceDetailPage({
  params,
}: {
  params: Promise<{ playbookKey: string }>;
}) {
  const { playbookKey } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) redirect("/dashboard");

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin/domains" },
          { label: "Playbook Performance", href: "/admin/autonomy/playbooks/performance" },
          { label: playbookKey },
        ]}
        title={playbookKey}
        description="Detailed performance metrics and trend"
      />
      <PlaybookPerformanceDetailClient playbookKey={playbookKey} />
    </div>
  );
}
