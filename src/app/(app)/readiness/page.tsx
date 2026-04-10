import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canRole } from "@/lib/rbac/permissions";
import { parseOrgRole } from "@/lib/rbac/roles";
import { ReadinessDashboard } from "@/components/readiness/ReadinessDashboard";

export default async function ReadinessPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership?.org_id) redirect("/onboarding");

  const orgRole = parseOrgRole((membership as { role?: string | null }).role ?? null);
  if (!canRole(orgRole, "change.approve")) {
    redirect("/home");
  }

  const orgId = (membership as { org_id: string }).org_id;

  return <ReadinessDashboard orgId={orgId} />;
}
