import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Stack } from "@/ui";
import SlackIntegrationCard from "@/components/integrations/SlackIntegrationCard";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

export default async function SlackIntegrationPage() {
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

  const { data: install } = await supabase
    .from("slack_installations")
    .select("team_id, team_name, default_channel_id, default_channel_name, status")
    .eq("org_id", activeOrgId)
    .maybeSingle();

  const { data: conn } = await supabase
    .from("integration_connections")
    .select("status, config, last_error, last_success_at, health_status")
    .eq("org_id", activeOrgId)
    .eq("provider", "slack")
    .maybeSingle();

  const c = conn as {
    status?: string;
    config?: {
      teamId?: string;
      teamName?: string;
      enabled?: boolean;
      features?: Record<string, boolean>;
      routing?: Record<string, string | null>;
      messagePolicy?: Record<string, boolean>;
    };
    last_error?: string;
    last_success_at?: string;
    health_status?: string;
  } | null;

  const connected = Boolean(install?.team_id && (install as { status?: string }).status === "ACTIVE");
  const config = c?.config ?? null;

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));

  return (
    <div className="max-w-2xl">
      <Stack gap={6}>
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Settings", href: "/org/settings" },
            { label: "Slack", href: "/org/settings/integrations/slack" },
          ]}
          title="Slack integration"
          description="Connect Slack to receive approval requests, risk alerts, and act on approvals from Slack."
          right={
            <Link href="/org/settings" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              ← Org settings
            </Link>
          }
        />
        <SlackIntegrationCard
          orgId={activeOrgId}
          isAdmin={isAdmin}
          connected={connected}
          teamName={(install as { team_name?: string })?.team_name ?? config?.teamName ?? null}
          config={config}
          lastError={c?.last_error ?? null}
          lastSuccessAt={c?.last_success_at ?? null}
          healthStatus={c?.health_status ?? null}
        />
      </Stack>
    </div>
  );
}
