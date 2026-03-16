import type { SupabaseClient } from "@supabase/supabase-js";

export async function enableDomainForOrg(
  supabaseAdmin: SupabaseClient,
  args: { orgId: string; domainKey: string }
) {
  const { orgId, domainKey } = args;

  await supabaseAdmin.from("org_domains").upsert(
    { org_id: orgId, domain_key: domainKey, enabled: true, config: {} },
    { onConflict: "org_id,domain_key" }
  );

  await supabaseAdmin.from("org_domain_policies").upsert(
    {
      org_id: orgId,
      domain_key: domainKey,
      sla_policy_key: "DEFAULT",
      config: {},
    },
    { onConflict: "org_id,domain_key" }
  );

  const { data: defs } = await supabaseAdmin
    .from("domain_signals")
    .select("signal_key, default_weight")
    .eq("domain_key", domainKey);

  for (const s of defs ?? []) {
    const row = s as { signal_key: string; default_weight?: number };
    await supabaseAdmin.from("org_signal_overrides").upsert(
      {
        org_id: orgId,
        domain_key: domainKey,
        signal_key: row.signal_key,
        enabled: true,
        weight_override: null,
        config_override: {},
      },
      { onConflict: "org_id,domain_key,signal_key" }
    );
  }
}
