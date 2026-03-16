import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Stack } from "@/ui";
import SalesforceIntegrationCard from "@/components/integrations/SalesforceIntegrationCard";
import { IntegrationCapabilityTransparency } from "@/components/integrations/IntegrationCapabilityTransparency";
import { getReadinessMeta, getReadinessBadgeLabel } from "@/lib/integrations/readiness";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

export default async function SalesforceIntegrationPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");
  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  if (!activeOrgId || !membership) {
    return (
      <Stack gap={4}>
        <p className="text-sm">No organization selected.</p>
        <Link href="/dashboard" className="text-sm font-semibold text-[var(--primary)]">Back</Link>
      </Stack>
    );
  }
  const { data: sfOrg } = await supabase
    .from("salesforce_orgs")
    .select("sf_org_id, instance_url")
    .eq("org_id", activeOrgId)
    .maybeSingle();
  const { data: conn } = await supabase
    .from("integration_connections")
    .select("last_error, last_success_at, health_status")
    .eq("org_id", activeOrgId)
    .eq("provider", "salesforce")
    .maybeSingle();

  const { data: objectConfigs } = await supabase
    .from("salesforce_object_configs")
    .select("object_api_name, enabled")
    .eq("org_id", activeOrgId);

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));
  const readinessMeta = getReadinessMeta("salesforce");
  const readinessLabel = readinessMeta ? getReadinessBadgeLabel(readinessMeta.tier) : null;

  return (
    <div className="max-w-2xl">
      <Stack gap={6}>
        <PageHeader
          breadcrumbs={[
            { label: "Overview", href: "/dashboard" },
            { label: "Settings", href: "/org/settings" },
            { label: "Integrations", href: "/org/settings/integrations" },
            { label: "Salesforce" },
          ]}
          title="Salesforce"
          description="Connect Salesforce for CRM change detection and governance."
          right={
            <div className="flex flex-wrap items-center gap-3">
              {readinessLabel && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  {readinessLabel}
                </span>
              )}
              {isAdmin && (
                <>
                  <Link href="/org/settings/integrations/salesforce/setup" className="text-sm font-semibold text-[var(--primary)] hover:underline">
                    {sfOrg ? "Setup wizard" : "Set up Salesforce"}
                  </Link>
                  <Link href="/org/settings/integrations" className="text-sm font-semibold text-[var(--primary)] hover:underline">← Integrations</Link>
                </>
              )}
            </div>
          }
        />
        <SalesforceIntegrationCard
          orgId={activeOrgId}
          isAdmin={isAdmin}
          connected={!!sfOrg}
          sfOrgId={(sfOrg as { sf_org_id?: string })?.sf_org_id ?? null}
          instanceUrl={(sfOrg as { instance_url?: string })?.instance_url ?? null}
          lastError={(conn as { last_error?: string })?.last_error ?? null}
          lastSuccessAt={(conn as { last_success_at?: string })?.last_success_at ?? null}
          healthStatus={(conn as { health_status?: string })?.health_status ?? null}
          objectsMonitored={(objectConfigs as { object_api_name: string; enabled?: boolean }[] | null)
            ?.filter((o) => o.enabled !== false)
            ?.map((o) => o.object_api_name) ?? []}
        />
        {readinessMeta && (
          <IntegrationCapabilityTransparency
            whatWeMonitor={readinessMeta.whatWeMonitor}
            whatWeDoNotMonitor={readinessMeta.whatWeDoNotMonitor}
          />
        )}
      </Stack>
    </div>
  );
}
