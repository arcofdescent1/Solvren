import type { SupabaseClient } from "@supabase/supabase-js";

export async function assertDomainEnabled(
  supabase: SupabaseClient,
  args: { orgId: string; domainKey: string }
) {
  const { orgId, domainKey } = args;
  const { data, error } = await supabase
    .from("org_domains")
    .select("enabled")
    .eq("org_id", orgId)
    .eq("domain_key", domainKey)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.enabled) throw new Error(`Domain not enabled: ${domainKey}`);
}
