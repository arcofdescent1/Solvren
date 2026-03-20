/**
 * Phase 4 — Integration Reliability Panel (§19).
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { getAccountsByOrg } from "@/modules/integrations/core/integrationAccountsRepo";
import { getLatestConnectorHealth } from "@/modules/integrations/reliability/repositories/connector-health-snapshots.repository";
import { listDeadLetters } from "@/modules/integrations/reliability/repositories/integration-dead-letters.repository";
import { listActionExecutions } from "@/modules/integrations/reliability/repositories/integration-action-executions.repository";
import { IntegrationReliabilityClient } from "@/components/integrations/IntegrationReliabilityClient";

export default async function IntegrationReliabilityPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  if (!activeOrgId || !membership) redirect("/dashboard");

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));
  if (!isAdmin) redirect("/dashboard");

  const { data: accounts } = await getAccountsByOrg(supabase, activeOrgId);
  const healthData = await Promise.all(
    (accounts ?? []).map(async (a) => {
      const { data: snap } = await getLatestConnectorHealth(supabase, a.id);
      return {
        id: a.id,
        provider: a.provider,
        displayName: a.display_name,
        status: a.status,
        healthState: snap?.health_state ?? "HEALTHY",
        metrics: (snap?.metrics_json ?? {}) as Record<string, number>,
        lastSuccessAt: a.last_success_at,
        lastErrorAt: a.last_error_at,
      };
    })
  );

  const { data: deadLetters } = await listDeadLetters(supabase, activeOrgId, { status: "OPEN" }, 20);
  const { data: recentExecutions } = await listActionExecutions(supabase, activeOrgId, {}, 10);

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin/domains" },
          { label: "Integration Reliability" },
        ]}
        title="Integration Reliability"
        description="Connector health, action executions, and dead-letter queue."
        right={
          <Link href="/admin/domains" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ← Admin
          </Link>
        }
      />
      <IntegrationReliabilityClient
        healthData={healthData}
        deadLetters={deadLetters ?? []}
        recentExecutions={recentExecutions ?? []}
      />
    </div>
  );
}
