import type { SupabaseClient } from "@supabase/supabase-js";

export async function getEnabledDomains(
  supabase: SupabaseClient,
  orgId: string
) {
  const { data, error } = await supabase
    .from("org_domains")
    .select("domain_key, enabled, config")
    .eq("org_id", orgId)
    .eq("enabled", true);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getDomainRequirements(
  supabase: SupabaseClient,
  domainKey: string
) {
  const { data, error } = await supabase
    .from("domain_approval_requirements")
    .select("approval_area, required_kinds, required_approvals, config")
    .eq("domain_key", domainKey);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getDomainSignalsWithOverrides(
  supabase: SupabaseClient,
  args: { orgId: string; domainKey: string }
) {
  const { orgId, domainKey } = args;

  const { data: defs, error: dErr } = await supabase
    .from("domain_signals")
    .select("signal_key,name,description,severity,default_weight,detector")
    .eq("domain_key", domainKey);

  if (dErr) throw new Error(dErr.message);

  const { data: ov } = await supabase
    .from("org_signal_overrides")
    .select("signal_key,enabled,weight_override,config_override")
    .eq("org_id", orgId)
    .eq("domain_key", domainKey);

  const byKey = new Map<string, Record<string, unknown>>(
    (ov ?? []).map((r: Record<string, unknown>) => [
      r.signal_key as string,
      r,
    ])
  );

  return (defs ?? []).map((s: Record<string, unknown>) => {
    const o = byKey.get(s.signal_key as string);
    return {
      ...s,
      enabled: o ? !!o.enabled : true,
      weight: (o?.weight_override as number | null) ?? (s.default_weight as number),
      detector: {
        ...((s.detector as Record<string, unknown>) ?? {}),
        ...((o?.config_override as Record<string, unknown>) ?? {}),
      },
    };
  });
}
