import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Stack } from "@/ui";
import JiraIntegrationCard from "@/components/integrations/JiraIntegrationCard";
import { IntegrationCapabilityTransparency } from "@/components/integrations/IntegrationCapabilityTransparency";
import { getReadinessMeta, getReadinessBadgeLabel } from "@/lib/integrations/readiness";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

export default async function JiraIntegrationPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(
    supabase,
    userRes.user.id
  );
  const membership = memberships.find((m) => m.orgId === activeOrgId);

  if (!activeOrgId || !membership) {
    return (
      <Stack gap={4}>
        <p className="text-sm text-[var(--text)]">No organization selected.</p>
        <Link href="/dashboard" className="text-sm font-semibold text-[var(--primary)] hover:underline">
          Back to dashboard
        </Link>
      </Stack>
    );
  }

  const { data: jiraConn } = await supabase
    .from("integration_connections")
    .select("status, config, last_error, last_success_at, health_status")
    .eq("org_id", activeOrgId)
    .eq("provider", "jira")
    .maybeSingle();

  const c = jiraConn as {
    status?: string;
    config?: {
      cloudId?: string;
      siteUrl?: string;
      siteName?: string;
      enabled?: boolean;
      projects?: string[];
      issueTypes?: string[];
      fieldMappings?: Record<string, string>;
      statusMappings?: Record<string, string>;
      features?: {
        webhookSync?: boolean;
        issuePropertySync?: boolean;
        commentSync?: boolean;
        workflowBlocking?: boolean;
      };
    };
    last_error?: string;
    last_success_at?: string;
    health_status?: string;
  } | null;

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));
  const readinessMeta = getReadinessMeta("jira");
  const readinessLabel = readinessMeta ? getReadinessBadgeLabel(readinessMeta.tier) : null;

  return (
    <div className="max-w-2xl">
      <Stack gap={6}>
        <PageHeader
          breadcrumbs={[
            { label: "Overview", href: "/dashboard" },
            { label: "Settings", href: "/org/settings" },
            { label: "Integrations", href: "/org/settings/integrations" },
            { label: "Jira" },
          ]}
          title="Jira integration"
          description="Connect Jira Cloud to create Solvren changes from Jira issues, sync status, and display governance status in Jira."
          right={
            <div className="flex flex-wrap items-center gap-3">
              {readinessLabel && (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                  {readinessLabel}
                </span>
              )}
              {isAdmin && (
                <>
                  <Link
                    href={`/org/settings/integrations/jira/setup?orgId=${activeOrgId}`}
                    className="text-sm font-semibold text-[var(--primary)] hover:underline"
                  >
                    {!c || c.status === "disconnected" ? "Set up Jira" : "Edit setup"}
                  </Link>
                  <Link href="/org/settings/integrations" className="text-sm font-semibold text-[var(--primary)] hover:underline">
                    ← Integrations
                  </Link>
                </>
              )}
            </div>
          }
        />
        <JiraIntegrationCard
          orgId={activeOrgId}
          isAdmin={isAdmin}
          connected={c?.status === "connected" || c?.status === "configured"}
          config={c?.config ?? null}
          lastError={c?.last_error ?? null}
          lastSuccessAt={c?.last_success_at ?? null}
          healthStatus={c?.health_status ?? null}
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
