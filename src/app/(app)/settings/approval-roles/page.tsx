import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Stack } from "@/ui";
import ApprovalRolesClient from "./ApprovalRolesClient";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

export default async function ApprovalRolesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  const isAdmin = isAdminLikeRole(parseOrgRole(membership?.role ?? null));
  if (!activeOrgId || !membership) redirect("/dashboard");

  if (!isAdmin) {
    return (
      <Stack gap={4}>
        <p className="text-sm text-[var(--text)]">Only org owners/admins can manage approval roles.</p>
        <Link href="/dashboard" className="text-sm font-semibold text-[var(--primary)] hover:underline">
          Back to dashboard
        </Link>
      </Stack>
    );
  }

  return <ApprovalRolesClient orgId={activeOrgId} />;
}
