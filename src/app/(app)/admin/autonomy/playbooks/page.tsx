/**
 * Phase 8 — Playbook Catalog page (§19.2).
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Card, CardBody } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { PlaybookCatalogClient } from "@/components/autonomy/PlaybookCatalogClient";

export default async function PlaybookCatalogPage() {
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
        <PageHeader
          title="Playbook Catalog"
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Admin" }, { label: "Playbooks" }]}
        />
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text-muted)]">Only org admins can access the Playbook catalog.</p>
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
          { label: "Playbooks" },
        ]}
        title="Playbook Catalog"
        description="Multi-step orchestration workflows for revenue recovery, funnel protection, and data repair."
        right={
          <Link href="/admin/autonomy/policy" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            Policy Center →
          </Link>
        }
      />
      <PlaybookCatalogClient orgId={activeOrgId} />
    </div>
  );
}
