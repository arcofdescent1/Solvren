import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";

export async function verifiedUser() {
  const supabase = await serverSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/sign-in");
  if (!user.email_confirmed_at) redirect("/verify-email");
  return { supabase, user };
}

export async function organizationAccess(orgId: string, ownerOnly = false) {
  const { supabase, user } = await verifiedUser();
  const { data: membership, error } = await supabase.from("organization_members")
    .select("role").eq("org_id", orgId).eq("user_id", user.id).maybeSingle();
  if (error || !membership) redirect("/workspace");
  const role = membership.role as "owner" | "finance" | "engineer" | "viewer";
  if (role !== "viewer") {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.currentLevel !== "aal2") redirect(`/mfa?next=${encodeURIComponent(`/o/${orgId}${ownerOnly ? "/team" : ""}`)}`);
  }
  if (ownerOnly && role !== "owner") redirect(`/o/${orgId}`);
  return { supabase, user, role };
}
