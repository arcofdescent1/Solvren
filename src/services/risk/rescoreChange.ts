import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import type { SupabaseClient } from "@supabase/supabase-js";
import { scoreRevenueChange } from "@/services/risk/scoreRevenue";
import { recomputeAndPersistRevenueFields } from "@/services/risk/revenuePersist";
import { evaluateDeterministicRules } from "@/services/risk/deterministicRules";

function extractSignals(d: unknown): string[] {
  if (Array.isArray(d)) return d.filter((x): x is string => typeof x === "string");
  if (d && typeof d === "object") return Object.keys(d);
  return [];
}

export async function rescoreRevenueChange(
  supabase: SupabaseClient,
  args: { changeId: string; orgId: string }
) {
  const { changeId, orgId } = args;

  const { data: change, error } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, org_id, domain, detected_signals"))
    .eq("id", changeId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!change) throw new Error("Change not found");

  let deterministic: { baseRisk: number; detectedSignals: string[]; explanation: Record<string, unknown> };
  try {
    deterministic = await evaluateDeterministicRules(supabase, { orgId, changeId });
  } catch {
    const { data: signals } = await supabase
      .from("risk_signals")
      .select("signal_key")
      .eq("change_event_id", changeId);
    const signalKeys = Array.from(
      new Set((signals ?? []).map((s) => (s as { signal_key: string }).signal_key))
    ).filter(Boolean);
    const { data: assessment } = await supabase
      .from("impact_assessments")
      .select("risk_score_raw")
      .eq("change_event_id", changeId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const baseRisk = Number(assessment?.risk_score_raw ?? 0);
    deterministic = {
      baseRisk: baseRisk > 0 ? baseRisk : 10,
      detectedSignals: signalKeys.length ? signalKeys : extractSignals((change as { detected_signals?: unknown }).detected_signals),
      explanation: {},
    };
  }

  const detectedSignals =
    deterministic.detectedSignals.length > 0
      ? deterministic.detectedSignals
      : extractSignals((change as { detected_signals?: unknown }).detected_signals);

  const scored = await scoreRevenueChange(supabase, {
    changeId,
    orgId,
    domain: (change as { domain?: string }).domain ?? "REVENUE",
    detectedSignals,
    baseRisk: deterministic.baseRisk,
  });

  const revenue = await recomputeAndPersistRevenueFields(supabase, { changeId });

  await supabase
    .from("change_events")
    .update({
      risk_explanation: {
        ...(scored.explanation ?? {}),
        deterministic: deterministic.explanation ?? {},
      },
    })
    .eq("id", changeId);

  return { ...scored, revenue };
}
