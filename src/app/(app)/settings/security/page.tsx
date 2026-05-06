import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Stack } from "@/ui";
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
      </Stack>
    </div>
  );
}
