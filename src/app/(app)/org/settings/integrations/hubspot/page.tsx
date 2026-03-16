import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Stack } from "@/ui";
import HubSpotIntegrationCard from "@/components/integrations/HubSpotIntegrationCard";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

export default async function HubSpotIntegrationPage() {
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
  const { data: account } = await supabase.from("hubspot_accounts").select("hub_id, auth_mode").eq("org_id", activeOrgId).maybeSingle();
  const { data: conn } = await supabase
    .from("integration_connections")
    .select("last_error, last_success_at, health_status")
    .eq("org_id", activeOrgId)
    .eq("provider", "hubspot")
    .maybeSingle();
  const { data: objectConfigs } = await supabase
    .from("hubspot_object_configs")
    .select("object_type, enabled")
    .eq("org_id", activeOrgId);

  return (
    <div className="max-w-2xl">
      <Stack gap={6}>
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Settings", href: "/org/settings" },
            { label: "HubSpot", href: "/org/settings/integrations/hubspot" },
          ]}
          title="HubSpot"
          description="Connect HubSpot for CRM change detection and governance."
          right={
            <div className="flex items-center gap-4">
              <Link href="/org/settings/integrations/hubspot/setup" className="text-sm font-semibold text-[var(--primary)]">
                {account ? "Setup wizard" : "Set up HubSpot"}
              </Link>
              <Link href="/org/settings" className="text-sm font-semibold text-[var(--primary)]">← Org settings</Link>
            </div>
          }
        />
        <HubSpotIntegrationCard
          orgId={activeOrgId}
          isAdmin={isAdminLikeRole(parseOrgRole(membership.role ?? null))}
          connected={!!account}
          hubId={(account as { hub_id?: number })?.hub_id ?? null}
          authMode={(account as { auth_mode?: string })?.auth_mode ?? null}
          lastError={(conn as { last_error?: string })?.last_error ?? null}
          lastSuccessAt={(conn as { last_success_at?: string })?.last_success_at ?? null}
          healthStatus={(conn as { health_status?: string })?.health_status ?? null}
          objectsMonitored={(objectConfigs as { object_type: string; enabled?: boolean }[] | null)
            ?.filter((o) => o.enabled !== false)
            ?.map((o) => o.object_type) ?? []}
        />
      </Stack>
    </div>
  );
}
