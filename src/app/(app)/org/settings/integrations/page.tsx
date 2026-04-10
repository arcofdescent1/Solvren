/**
 * Gap 3 — Integration marketplace with readiness tiers and transparent capability.
 * Route also reachable as /settings/integrations (redirect).
 */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { getIntegrationsList } from "@/lib/integrations/list";
import {
  getReadinessMeta,
  getReadinessBadgeLabel,
  type ReadinessTier,
} from "@/lib/integrations/readiness";
import { PageHeader, Card, CardBody, Badge } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

const PROVIDER_ROUTES: Record<
  string,
  { href: string; setupHref: string }
> = {
  jira: {
    href: "/org/settings/integrations/jira",
    setupHref: "/org/settings/integrations/jira/setup",
  },
  slack: {
    href: "/org/settings/integrations/slack",
    setupHref: "/org/settings/integrations/slack",
  },
  salesforce: {
    href: "/org/settings/integrations/salesforce",
    setupHref: "/org/settings/integrations/salesforce/setup",
  },
  hubspot: {
    href: "/org/settings/integrations/hubspot",
    setupHref: "/org/settings/integrations/hubspot/setup",
  },
  netsuite: {
    href: "/org/settings/integrations/netsuite",
    setupHref: "/org/settings/integrations/netsuite/setup",
  },
  github: {
    href: "/org/settings/integrations/github",
    setupHref: "/org/settings/integrations/github",
  },
  stripe: {
    href: "/org/settings/integrations/stripe",
    setupHref: "/org/settings/integrations/stripe",
  },
  csv: {
    href: "/imports/new",
    setupHref: "/imports/new",
  },
  postgres_readonly: {
    href: "/org/settings/integrations/postgres-readonly",
    setupHref: "/org/settings/integrations/postgres-readonly",
  },
  mysql_readonly: {
    href: "/org/settings/integrations/mysql-readonly",
    setupHref: "/org/settings/integrations/mysql-readonly",
  },
  snowflake: {
    href: "/org/settings/integrations/snowflake",
    setupHref: "/org/settings/integrations/snowflake",
  },
  bigquery: {
    href: "/org/settings/integrations/bigquery",
    setupHref: "/org/settings/integrations/bigquery",
  },
};

function ReadinessBadge({ tier }: { tier: ReadinessTier }) {
  const label = getReadinessBadgeLabel(tier);
  const className =
    tier === "production"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
      : tier === "beta"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
        : "bg-[var(--bg-muted)] text-[var(--text-muted)]";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}
    >
      {label}
    </span>
  );
}

function formatRelativeTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60e3) return "Just now";
  if (diff < 3600e3) return `${Math.floor(diff / 60e3)}m ago`;
  if (diff < 86400e3) return `${Math.floor(diff / 3600e3)}h ago`;
  return `${Math.floor(diff / 86400e3)}d ago`;
}

export default async function IntegrationsMarketplacePage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);

  if (!activeOrgId || !membership) {
    return (
      <div className="space-y-4">
        <PageHeader
          breadcrumbs={[
            { label: "Overview", href: "/dashboard" },
            { label: "Settings", href: "/org/settings" },
            { label: "Integrations" },
          ]}
          title="Integrations"
        />
        <p className="text-sm text-[var(--text-muted)]">No organization selected.</p>
      </div>
    );
  }

  const integrations = await getIntegrationsList(supabase, activeOrgId);
  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));

  const allProviders = [
    "jira",
    "slack",
    "salesforce",
    "hubspot",
    "stripe",
    "netsuite",
    "github",
    "postgres_readonly",
    "mysql_readonly",
    "snowflake",
    "bigquery",
  ] as const;

  return (
    <div className="max-w-4xl">
      <PageHeader
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Settings", href: "/org/settings" },
          { label: "Integrations", href: "/org/settings/integrations" },
        ]}
        title="Integrations"
        description="Connect systems for risk detection and governance. Each integration shows its readiness tier."
        right={
          <div className="flex items-center gap-4">
            <Link href="/imports/new" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              Spreadsheet imports
            </Link>
            <Link href="/integrations/mappings" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              Mappings
            </Link>
            <Link href="/org/settings" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              ← Settings
            </Link>
          </div>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {allProviders.map((p) => {
          const entry = integrations[p];
          const meta = getReadinessMeta(p);
          const routes = PROVIDER_ROUTES[p];
          const connected = entry?.connected ?? false;
          const connMeta = entry?.meta as Record<string, unknown> | undefined;
          const healthStatus = (connMeta?.health_status as string) ?? (connected ? "healthy" : null);
          const lastSuccess = connMeta?.last_success_at as string | undefined;

          const name = meta?.name ?? p;
          const shortDescription = meta?.shortDescription ?? "Connect for revenue context.";
          const tier = meta?.tier ?? "coming_soon";

          return (
            <Card key={p} className="flex flex-col">
              <CardBody className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-[var(--text)]">{name}</h3>
                    <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                      {shortDescription}
                    </p>
                  </div>
                  <ReadinessBadge tier={tier} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={connected ? "success" : "outline"}>
                    {connected ? "Connected" : "Disconnected"}
                  </Badge>
                  {healthStatus && connected && (
                    <Badge
                      variant={
                        healthStatus === "healthy"
                          ? "success"
                          : healthStatus === "degraded"
                            ? "secondary"
                            : "danger"
                      }
                      className="text-xs"
                    >
                      {healthStatus === "healthy" ? "Healthy" : healthStatus === "degraded" ? "Degraded" : "Error"}
                    </Badge>
                  )}
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-[var(--border)] pt-3 text-sm text-[var(--text-muted)]">
                  <span>Last sync: {formatRelativeTime(lastSuccess)}</span>
                  <div className="flex items-center gap-2">
                    {isAdmin ? (
                      <>
                        <Link
                          href={
                            connected
                              ? `${routes?.href ?? "#"}?orgId=${activeOrgId}`
                              : `${routes?.setupHref ?? "#"}?orgId=${activeOrgId}`
                          }
                          className="font-medium text-[var(--primary)] hover:underline"
                        >
                          {connected ? "Configure" : "Connect"}
                        </Link>
                        {tier === "beta" && !connected && (
                          <Link
                            href={routes?.href ?? "#"}
                            className="text-[var(--text-muted)] hover:underline"
                          >
                            Learn more
                          </Link>
                        )}
                      </>
                    ) : (
                      <Link
                        href={`${routes?.href ?? "#"}?orgId=${activeOrgId}`}
                        className="font-medium text-[var(--primary)] hover:underline"
                      >
                        View status
                      </Link>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
