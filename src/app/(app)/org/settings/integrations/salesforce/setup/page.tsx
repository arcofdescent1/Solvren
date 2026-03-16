import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Stack } from "@/ui";
import { SalesforceSetupWizard } from "@/components/integrations/salesforce-setup/SalesforceSetupWizard";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

export default async function SalesforceSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string; step?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const params = await searchParams;
  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  const orgId = params.orgId ?? activeOrgId;

  if (!orgId || !membership) {
    return (
      <Stack gap={4}>
        <p className="text-sm">No organization selected.</p>
        <Link href="/dashboard" className="text-sm font-semibold text-[var(--primary)]">Back to dashboard</Link>
      </Stack>
    );
  }

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));

  const { data: sfOrg } = await supabase
    .from("salesforce_orgs")
    .select("sf_org_id")
    .eq("org_id", orgId)
    .maybeSingle();

  const { data: conn } = await supabase
    .from("integration_connections")
    .select("config")
    .eq("org_id", orgId)
    .eq("provider", "salesforce")
    .maybeSingle();

  const config = (conn as { config?: { objects?: { objectApiName: string; enabled?: boolean }[] } } | null)?.config ?? null;
  const connected = !!sfOrg;

  return (
    <div className="max-w-2xl">
      <Stack gap={6}>
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Settings", href: "/org/settings" },
            { label: "Salesforce", href: "/org/settings/integrations/salesforce" },
            { label: "Setup", href: "/org/settings/integrations/salesforce/setup" },
          ]}
          title="Salesforce setup"
          description="Connect and configure Salesforce for CRM change detection."
          right={
            <Link href="/org/settings/integrations/salesforce" className="text-sm font-semibold text-[var(--primary)]">
              ← Integration page
            </Link>
          }
        />
        <SalesforceSetupWizard
          orgId={orgId}
          connected={connected}
          isAdmin={!!isAdmin}
          config={config}
          initialStep={params.step}
        />
      </Stack>
    </div>
  );
}
