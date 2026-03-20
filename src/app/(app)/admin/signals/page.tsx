/**
 * Phase 3 — Admin Signals page (§16).
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Card, CardBody } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { SignalsAdminClient } from "@/components/signals/SignalsAdminClient";

export default async function AdminSignalsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  if (!activeOrgId || !membership) redirect("/dashboard");

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));
  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <PageHeader title="Signals" breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Admin" }, { label: "Signals" }]} />
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text-muted)]">Only org admins can access the Signals console.</p>
            <Link href="/dashboard" className="mt-2 inline-block text-sm font-semibold text-[var(--primary)] hover:underline">
              ← Dashboard
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin/domains" },
          { label: "Signals" },
        ]}
        title="Signals"
        description="Signal ingestion, normalization, and coverage. Raw events, normalized signals, and dead-letter queue."
        right={
          <Link href="/admin/identity" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            Identity →
          </Link>
        }
      />
      <SignalsAdminClient orgId={activeOrgId} />
    </div>
  );
}
