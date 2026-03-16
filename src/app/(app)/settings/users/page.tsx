import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Stack } from "@/ui";
import UsersManagement from "./UsersManagement";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

export default async function SettingsUsersPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  const isAdmin = isAdminLikeRole(parseOrgRole(membership?.role ?? null));
  const orgName = membership?.orgName ?? null;

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

  if (!isAdmin) {
    return (
      <Stack gap={4}>
        <p className="text-sm text-[var(--text)]">Only org owners/admins can manage users and invites.</p>
        <Link href="/dashboard" className="text-sm font-semibold text-[var(--primary)] hover:underline">
          Back to dashboard
        </Link>
      </Stack>
    );
  }

  return (
    <div className="max-w-4xl">
      <Stack gap={6}>
        <PageHeader
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Settings", href: "/org/settings" },
            { label: "Users", href: "/settings/users" },
          ]}
          title="Team & invites"
          description="Manage members, pending invites, and invite new users by email."
          right={
            <Link href="/org/settings" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              ← Org settings
            </Link>
          }
        />
        <UsersManagement orgId={activeOrgId} orgName={orgName} currentUserId={userRes.user.id} />
      </Stack>
    </div>
  );
}
