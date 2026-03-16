import type { SupabaseClient } from "@supabase/supabase-js";

export async function getLearnedMultiplierForSignals(
  supabase: SupabaseClient,
  args: {
    orgId: string;
    domain: string;
    signalKeys: string[];
    modelVersion?: number;
  }
) {
  const { orgId, domain, signalKeys, modelVersion = 1 } = args;
  const uniq = Array.from(new Set(signalKeys)).filter(Boolean);
  if (!uniq.length) return { multiplier: 1.0, details: [] as unknown[] };

  const { data, error } = await supabase
    .from("signal_stats")
    .select(
      "signal_key,learned_multiplier,learned_multiplier_reason,total_changes,incident_changes"
    )
    .eq("org_id", orgId)
    .eq("domain", domain)
    .eq("model_version", modelVersion)
    .in("signal_key", uniq);

  if (error) return { multiplier: 1.0, details: [] as unknown[] };

  const details = (data ?? []).map((r: Record<string, unknown>) => ({
    signalKey: r.signal_key,
    learnedMultiplier: Number(r.learned_multiplier ?? 1),
    reason: r.learned_multiplier_reason ?? {},
    totalChanges: r.total_changes,
    incidentChanges: r.incident_changes,
  }));

  const multiplier = details.reduce(
    (m: number, d: { learnedMultiplier: number }) =>
      Math.max(m, d.learnedMultiplier),
    1.0
  );

  return { multiplier, details };
}
