import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { Card, CardBody, Grid, PageHeader, Stack } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { SecuritySettingsClient } from "./SecuritySettingsClient";

export default async function SecuritySettingsPage() {
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

  const canManage = isAdminLikeRole(parseOrgRole(membership.role ?? null));

  return (
    <div className="max-w-3xl">
      <Stack gap={6}>
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Settings", href: "/settings" },
            { label: "Security" },
          ]}
          title="Security & data protection"
          description="Privacy mode, write-back controls, and how Solvren handles your data. Public architecture and policy: /security"
        />
        <SecuritySettingsClient orgId={activeOrgId} canManage={canManage} />

        <Card>
          <CardBody>
            <h2 className="text-base font-semibold">Enterprise trust controls</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Security reviewers can trace who has access, how support access is controlled, and where audit evidence lives.
            </p>
            <Grid cols={1} gap={3} className="mt-4 md:grid-cols-2">
              {[
                {
                  label: "Permission matrix",
                  body: "Who can view, edit, approve, restrict, and grant access.",
                  href: "/docs/admin/permission-matrix",
                },
                {
                  label: "Audit coverage",
                  body: "Revenue, approval, integration, support access, and tenant purge audit expectations.",
                  href: "/docs/admin/audit-coverage-matrix",
                },
                {
                  label: "Support access",
                  body: "Customer-controlled support access and break-glass review.",
                  href: "/settings/security/support-access",
                },
                {
                  label: "Domain permissions",
                  body: "Control which reviewers can see and approve sensitive domains.",
                  href: "/settings/domain-permissions",
                },
                {
                  label: "Audit trail",
                  body: "Review tenant activity and security-relevant events.",
                  href: "/risk/audit",
                },
                {
                  label: "Public trust center",
                  body: "Security posture, infrastructure, policies, and customer-facing materials.",
                  href: "/security",
                },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3 transition hover:border-[var(--primary)]/40"
                >
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{item.body}</p>
                </Link>
              ))}
            </Grid>
          </CardBody>
        </Card>
      </Stack>
    </div>
  );
}
