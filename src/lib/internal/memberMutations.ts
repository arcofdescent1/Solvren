import type { SupabaseClient } from "@supabase/supabase-js";

export async function countOwners(admin: SupabaseClient, orgId: string): Promise<number> {
  const { count } = await admin
    .from("organization_members")
    .select("user_id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("role", "owner");
  return count ?? 0;
}
