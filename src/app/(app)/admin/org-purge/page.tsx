import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Card, CardBody } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { hasPermissionInOrg } from "@/lib/rbac/can";
import OrgPurgeClient from "./OrgPurgeClient";

export default async function OrgPurgePage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  if (!activeOrgId || !membership) redirect("/dashboard");

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));
  if (!isAdmin) redirect("/dashboard");

  const canManage = await hasPermissionInOrg(supabase, userRes.user.id, activeOrgId, "domains.manage");
  if (!canManage) redirect("/dashboard");

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin/domains" },
          { label: "Org purge" },
        ]}
        title="Org purge (Phase 7)"
        description="Tenant offboarding: dry-run, approval, checkpointed execution, verification."
        right={
          <div className="flex gap-3">
            <Link href="/admin/security-operations" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              Security ops
            </Link>
            <Link href="/admin/domains" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              ← Admin
            </Link>
          </div>
        }
      />

      <Card>
        <CardBody>
          <p className="text-sm text-[var(--muted)]">
            Policy: <code className="text-xs">docs/architecture/org_purge_retention_exceptions.md</code> · Runbook:{" "}
            <code className="text-xs">docs/operations/org_purge_runbook.md</code>
          </p>
        </CardBody>
      </Card>

      <OrgPurgeClient orgId={activeOrgId} orgName={membership.orgName} />
    </div>
  );
}
