import type { SupabaseClient } from "@supabase/supabase-js";

export async function getMitigationsForSignals(
  supabase: SupabaseClient,
  args: { domainKey: string; signalKeys: string[] }
) {
  const { domainKey, signalKeys } = args;
  const uniq = Array.from(new Set(signalKeys)).filter(Boolean);
  if (!uniq.length) return [];

  const { data, error } = await supabase
    .from("domain_signal_mitigations")
    .select("signal_key, mitigation_key, recommendation, severity")
    .eq("domain_key", domainKey)
    .in("signal_key", uniq);

  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{
    signal_key: string;
    mitigation_key: string;
    recommendation: string | null;
    severity: string | null;
  }>;
}
