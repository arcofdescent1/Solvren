import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Stack } from "@/ui";
import NetSuiteIntegrationCard from "@/components/integrations/NetSuiteIntegrationCard";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

export default async function NetSuiteIntegrationPage() {
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
  const { data: account } = await supabase.from("netsuite_accounts").select("account_id, account_name").eq("org_id", activeOrgId).maybeSingle();
  const { data: conn } = await supabase
    .from("integration_connections")
    .select("last_error, last_success_at, health_status")
    .eq("org_id", activeOrgId)
    .eq("provider", "netsuite")
    .maybeSingle();
  return (
    <div className="max-w-2xl">
      <Stack gap={6}>
        <PageHeader
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Settings", href: "/org/settings" }, { label: "NetSuite", href: "/org/settings/integrations/netsuite" }]}
          title="NetSuite"
          description="Connect NetSuite for validation and reconciliation."
          right={
            <div className="flex items-center gap-4">
              <Link href="/org/settings/integrations/netsuite/setup" className="text-sm font-semibold text-[var(--primary)]">
                {account ? "Reconfigure" : "Set up NetSuite"}
              </Link>
              <Link href="/org/settings" className="text-sm font-semibold text-[var(--primary)]">← Org settings</Link>
            </div>
          }
        />
        <NetSuiteIntegrationCard
          orgId={activeOrgId}
          isAdmin={isAdminLikeRole(parseOrgRole(membership.role ?? null))}
          connected={!!account}
          accountId={(account as { account_id?: string })?.account_id ?? null}
          accountName={(account as { account_name?: string })?.account_name ?? null}
          lastError={(conn as { last_error?: string })?.last_error ?? null}
          lastSuccessAt={(conn as { last_success_at?: string })?.last_success_at ?? null}
          healthStatus={(conn as { health_status?: string })?.health_status ?? null}
        />
      </Stack>
    </div>
  );
}
