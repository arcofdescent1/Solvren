/**
 * Phase 8 — Policy Center page (§19.1).
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Card, CardBody, Stack } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { PolicyCenterClient } from "@/components/autonomy/PolicyCenterClient";

export default async function PolicyCenterPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  if (!activeOrgId || !membership) redirect("/dashboard");

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));
  if (!isAdmin) {
    return (
      <Stack gap={4}>
        <PageHeader
          title="Policy Center"
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Admin" }, { label: "Policy Center" }]}
        />
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text-muted)]">Only org admins can access the Policy Center.</p>
            <Link href="/dashboard" className="mt-2 inline-block text-sm font-semibold text-[var(--primary)] hover:underline">
              ← Dashboard
            </Link>
          </CardBody>
        </Card>
      </Stack>
    );
  }

  return (
    <Stack gap={6} className="max-w-5xl">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin/domains" },
          { label: "Policy Center" },
        ]}
        title="Policy Center"
        description="Define autonomy policies, approval requirements, and automation guardrails."
        right={
          <Link href="/admin/autonomy/playbooks" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            Playbooks →
          </Link>
        }
      />
      <PolicyCenterClient orgId={activeOrgId} />
    </Stack>
  );
}
