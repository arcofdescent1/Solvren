import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Stack } from "@/ui";
import GitHubIntegrationCard from "@/components/integrations/GitHubIntegrationCard";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

export default async function GitHubIntegrationPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
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

  const { data: inst } = await supabase
    .from("github_installations")
    .select("github_installation_id, github_account_login, github_account_type")
    .eq("org_id", activeOrgId)
    .maybeSingle();

  const { data: conn } = await supabase
    .from("integration_connections")
    .select("status, last_error, last_success_at, health_status")
    .eq("org_id", activeOrgId)
    .eq("provider", "github")
    .maybeSingle();

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));

  return (
    <div className="max-w-2xl">
      <Stack gap={6}>
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Settings", href: "/org/settings" },
            { label: "GitHub", href: "/org/settings/integrations/github" },
          ]}
          title="GitHub integration"
          description="Connect GitHub repositories to detect revenue-impacting changes from pull requests and pushes, and surface governance status in commit statuses."
          right={
            <Link href="/org/settings" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              ← Org settings
            </Link>
          }
        />
        <GitHubIntegrationCard
          orgId={activeOrgId}
          isAdmin={isAdmin}
          connected={!!inst}
          installation={inst ? { installationId: (inst as { github_installation_id: number }).github_installation_id, accountLogin: (inst as { github_account_login: string }).github_account_login, accountType: (inst as { github_account_type: string }).github_account_type } : null}
          lastError={(conn as { last_error?: string })?.last_error ?? null}
          lastSuccessAt={(conn as { last_success_at?: string })?.last_success_at ?? null}
          healthStatus={(conn as { health_status?: string })?.health_status ?? null}
        />
      </Stack>
    </div>
  );
}
