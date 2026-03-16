import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Stack } from "@/ui";
import { JiraSetupWizard } from "@/components/integrations/jira-setup/JiraSetupWizard";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

export default async function JiraSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string; step?: string; jira?: string }>;
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

  const { data: jiraConn } = await supabase
    .from("integration_connections")
    .select("status, config")
    .eq("org_id", orgId)
    .eq("provider", "jira")
    .maybeSingle();

  const c = jiraConn as {
    status?: string;
    config?: {
      cloudId?: string;
      siteUrl?: string;
      siteName?: string;
      projects?: string[];
      statusMappings?: Record<string, string>;
      features?: { webhookSync?: boolean; issuePropertySync?: boolean; commentSync?: boolean };
    };
  } | null;

  const connected = c?.status === "connected" || c?.status === "configured";
  const config = c?.config ?? null;

  return (
    <div className="max-w-2xl">
      <Stack gap={6}>
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Settings", href: "/org/settings" },
            { label: "Jira", href: "/org/settings/integrations/jira" },
            { label: "Setup", href: "/org/settings/integrations/jira/setup" },
          ]}
          title="Jira setup"
          description="Connect and configure Jira in a few steps."
          right={
            <Link href="/org/settings/integrations/jira" className="text-sm font-semibold text-[var(--primary)]">
              ← Integration page
            </Link>
          }
        />
        <JiraSetupWizard
          orgId={orgId}
          config={config}
          connected={!!connected}
          isAdmin={!!isAdmin}
          initialStep={params.step ?? (params.jira === "connected" ? "projects" : undefined)}
        />
      </Stack>
    </div>
  );
}
