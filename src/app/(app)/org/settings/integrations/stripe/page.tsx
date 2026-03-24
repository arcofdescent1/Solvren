/**
 * Phase 2 — Stripe integration setup: API key + webhook secret.
 */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Stack } from "@/ui";
import StripeIntegrationCard from "@/components/integrations/StripeIntegrationCard";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

export default async function StripeIntegrationPage() {
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

  const { data: creds } = await supabase
    .from("integration_credentials")
    .select("id")
    .eq("org_id", activeOrgId)
    .eq("provider", "stripe")
    .maybeSingle();
  const { data: conn } = await supabase
    .from("integration_connections")
    .select("status, config")
    .eq("org_id", activeOrgId)
    .eq("provider", "stripe")
    .maybeSingle();

  const connected = !!creds && (conn as { status?: string } | null)?.status === "connected";
  const config = (conn as { config?: { webhookConfigured?: boolean } } | null)?.config ?? {};

  return (
    <div className="max-w-2xl">
      <Stack gap={6}>
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Settings", href: "/org/settings" },
            { label: "Integrations", href: "/org/settings/integrations" },
            { label: "Stripe" },
          ]}
          title="Stripe"
          description="Identify failed payment patterns and at-risk subscription revenue."
          right={
            <Link href="/org/settings/integrations" className="text-sm font-semibold text-[var(--primary)]">
              ← Integrations
            </Link>
          }
        />
        <StripeIntegrationCard
          orgId={activeOrgId}
          isAdmin={isAdminLikeRole(parseOrgRole(membership.role ?? null))}
          connected={connected}
          webhookConfigured={config.webhookConfigured ?? false}
        />
        {connected && (
          <div className="rounded border border-[var(--border)] p-4 text-sm">
            <p className="font-medium">Next steps</p>
            <ul className="mt-2 list-disc pl-5 text-[var(--text-muted)]">
              <li>Configure object mappings at{" "}
                <Link href="/integrations/mappings" className="text-[var(--primary)] hover:underline">
                  Mappings
                </Link>
              </li>
              <li>Add webhook endpoint in Stripe Dashboard: <code className="rounded bg-[var(--bg-muted)] px-1">/api/integrations/stripe/webhook</code> (include x-org-id header)</li>
            </ul>
          </div>
        )}
      </Stack>
    </div>
  );
}
