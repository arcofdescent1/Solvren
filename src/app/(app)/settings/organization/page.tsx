import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Stack } from "@/ui";
import OrganizationSettingsClient from "./OrganizationSettingsClient";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

export default async function SettingsOrganizationPage() {
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

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));

  return (
    <div className="max-w-2xl">
      <Stack gap={6}>
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Settings", href: "/org/settings" },
            { label: "Organization", href: "/settings/organization" },
          ]}
          title="Organization settings"
          description="Manage organization profile, notifications, approval defaults, and integrations."
          right={
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/org/settings" className="text-sm font-semibold text-[var(--primary)] hover:underline">
                ← Org settings
              </Link>
              <Link href="/settings/users" className="text-sm font-semibold text-[var(--primary)] hover:underline">
                Team & invites
              </Link>
              <Link href="/settings/approval-roles" className="text-sm font-semibold text-[var(--primary)] hover:underline">
                Approval roles
              </Link>
              <Link href="/settings/domain-permissions" className="text-sm font-semibold text-[var(--primary)] hover:underline">
                Domain permissions
              </Link>
              <Link href="/settings/approval-mappings" className="text-sm font-semibold text-[var(--primary)] hover:underline">
                Approval mappings
              </Link>
            </div>
          }
        />
        {!isAdmin && (
          <p className="rounded-md border border-[var(--border)] bg-[var(--bg-surface-2)] px-3 py-2 text-sm text-[var(--text-muted)]">
            You can view organization settings. Only org owners/admins can edit.
          </p>
        )}
        <OrganizationSettingsClient orgId={activeOrgId} isAdmin={isAdmin} />
      </Stack>
    </div>
  );
}
