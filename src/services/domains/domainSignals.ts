import type { SupabaseClient } from "@supabase/supabase-js";

export async function getResolvedDomainSignals(
  supabase: SupabaseClient,
  args: { orgId: string; domainKey: string }
) {
  const { orgId, domainKey } = args;

  const { data: defs, error: dErr } = await supabase
    .from("domain_signals")
    .select("signal_key,name,description,severity,default_weight,detector")
    .eq("domain_key", domainKey);

  if (dErr) throw new Error(dErr.message);

  const { data: ovs } = await supabase
    .from("org_signal_overrides")
    .select("signal_key,enabled,weight_override,config_override")
    .eq("org_id", orgId)
    .eq("domain_key", domainKey);

  const byKey = new Map<string, Record<string, unknown>>(
    (ovs ?? []).map((r: Record<string, unknown>) => [String(r.signal_key ?? ""), r])
  );

  return (defs ?? [])
    .map((s: Record<string, unknown>) => {
      const o = byKey.get(String(s.signal_key ?? ""));
      const enabled = o ? !!o.enabled : true;
      return {
        signalKey: String(s.signal_key ?? ""),
        name: String(s.name ?? ""),
        severity: String(s.severity ?? "MEDIUM"),
        weight: Number(o?.weight_override ?? s.default_weight ?? 1),
        detector: { ...((s.detector as Record<string, unknown>) ?? {}), ...((o?.config_override as Record<string, unknown>) ?? {}) },
        enabled,
      };
    })
    .filter((s) => s.enabled);
}
