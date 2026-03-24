/**
 * Phase 3 — PostgreSQL integration setup.
 */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Stack } from "@/ui";
import PostgresIntegrationCard from "@/components/integrations/PostgresIntegrationCard";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { getAccountByOrgAndProvider } from "@/modules/integrations/core/integrationAccountsRepo";

export default async function PostgresIntegrationPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  if (!activeOrgId || !membership) redirect("/org/settings/integrations");

  const { data: account } = await getAccountByOrgAndProvider(supabase, activeOrgId, "postgres_readonly");
  const connected = account?.status === "connected";

  return (
    <div className="max-w-2xl">
      <Stack gap={6}>
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Settings", href: "/org/settings" },
            { label: "Integrations", href: "/org/settings/integrations" },
            { label: "PostgreSQL" },
          ]}
          title="PostgreSQL"
          description="Sync read-only data from PostgreSQL for revenue context."
          right={
            <Link href="/org/settings/integrations" className="text-sm font-semibold text-[var(--primary)]">
              ← Integrations
            </Link>
          }
        />
        <PostgresIntegrationCard
          orgId={activeOrgId}
          isAdmin={isAdminLikeRole(parseOrgRole(membership.role ?? null))}
          connected={!!connected}
        />
        {connected && (
          <div className="rounded border border-[var(--border)] p-4 text-sm">
            <p className="font-medium">Next steps</p>
            <ul className="mt-2 list-disc pl-5 text-[var(--text-muted)]">
              <li>
                <Link href="/integrations/mappings" className="text-[var(--primary)] hover:underline">
                  Configure object mappings
                </Link>
              </li>
            </ul>
          </div>
        )}
      </Stack>
    </div>
  );
}
