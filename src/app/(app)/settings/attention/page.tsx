import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import AttentionSettingsClient from "./AttentionSettingsClient";

export default async function AttentionSettingsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);

  if (!activeOrgId || !membership) {
    redirect("/dashboard");
  }

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));

  return (
    <div className="max-w-3xl">
      <AttentionSettingsClient orgId={activeOrgId} isAdmin={isAdmin} />
    </div>
  );
}
