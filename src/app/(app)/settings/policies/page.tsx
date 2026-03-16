import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import PoliciesClient from "./PoliciesClient";

export default async function PoliciesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");
  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  const isAdmin = isAdminLikeRole(parseOrgRole(membership?.role ?? null));
  if (!activeOrgId || !membership) redirect("/dashboard");
  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="font-semibold text-lg">Revenue Policies</h1>
        <p className="text-sm text-[var(--text-muted)]">Only org owners/admins can manage revenue policies.</p>
        <Link href="/dashboard" className="text-sm font-semibold text-[var(--primary)] hover:underline">Back to dashboard</Link>
      </div>
    );
  }
  return <PoliciesClient />;
}
