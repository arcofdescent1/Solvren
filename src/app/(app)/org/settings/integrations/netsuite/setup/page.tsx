import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Stack } from "@/ui";
import { NetSuiteSetupWizard } from "@/components/integrations/netsuite-setup/NetSuiteSetupWizard";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

export default async function NetSuiteSetupPage({
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
        <Link href="/dashboard" className="text-sm font-semibold text-[var(--primary)]">
          Back to dashboard
        </Link>
      </Stack>
    );
  }

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));

  const { data: account } = await supabase
    .from("netsuite_accounts")
    .select("account_id")
    .eq("org_id", orgId)
    .maybeSingle();

  const connected = !!account;

  return (
    <div className="max-w-2xl">
      <Stack gap={6}>
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Settings", href: "/org/settings" },
            { label: "NetSuite", href: "/org/settings/integrations/netsuite" },
            { label: "Setup", href: "/org/settings/integrations/netsuite/setup" },
          ]}
          title="NetSuite setup"
          description="Connect NetSuite in about 10 minutes. No SuiteScript required."
          right={
            <Link href="/org/settings/integrations/netsuite" className="text-sm font-semibold text-[var(--primary)]">
              ← Integration page
            </Link>
          }
        />
        <NetSuiteSetupWizard
          orgId={orgId}
          connected={connected}
          isAdmin={!!isAdmin}
          initialStep={params.step as "integration-record" | "credentials" | "validate" | "features" | "complete" | undefined}
        />
      </Stack>
    </div>
  );
}
