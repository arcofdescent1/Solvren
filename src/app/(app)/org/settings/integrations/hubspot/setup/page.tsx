import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Stack } from "@/ui";
import { HubSpotSetupWizard } from "@/components/integrations/hubspot-setup/HubSpotSetupWizard";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

export default async function HubSpotSetupPage({
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

  const { data: account } = await supabase.from("hubspot_accounts").select("hub_id").eq("org_id", orgId).maybeSingle();

  const { data: objs } = await supabase
    .from("hubspot_object_configs")
    .select("object_type, enabled")
    .eq("org_id", orgId);

  const config = objs?.length
    ? { objects: (objs as { object_type: string; enabled?: boolean }[]).map((o) => ({ objectType: o.object_type, enabled: o.enabled })) }
    : null;

  const connected = !!account;

  return (
    <div className="max-w-2xl">
      <Stack gap={6}>
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Settings", href: "/org/settings" },
            { label: "HubSpot", href: "/org/settings/integrations/hubspot" },
            { label: "Setup", href: "/org/settings/integrations/hubspot/setup" },
          ]}
          title="HubSpot setup"
          description="Connect and configure HubSpot for CRM change detection."
          right={
            <Link href="/org/settings/integrations/hubspot" className="text-sm font-semibold text-[var(--primary)]">
              ← Integration page
            </Link>
          }
        />
        <HubSpotSetupWizard orgId={orgId} connected={connected} isAdmin={!!isAdmin} config={config} initialStep={params.step} />
      </Stack>
    </div>
  );
}
