import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import type { SupabaseClient } from "@supabase/supabase-js";
import { trainLogReg } from "@/services/risk/ml/logreg";
import { featuresForChange } from "@/services/risk/ml/features";
import { evaluateDeterministicRules } from "@/services/risk/deterministicRules";

export async function trainOrgDomainModel(
  supabase: SupabaseClient,
  args: { orgId: string; domainKey: string; enableMl?: boolean }
) {
  const { orgId, domainKey, enableMl = true } = args;

  if (!enableMl) return { trained: false, reason: "ml_disabled" as const };

  const { data: changes, error } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, org_id, domain, created_at, estimated_mrr_affected, percent_customer_base_affected, revenue_surface"))
    .eq("org_id", orgId)
    .eq("domain", domainKey)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) throw new Error(error.message);
  const rows = changes ?? [];
  if (rows.length < 200) return { trained: false, reason: "insufficient_samples" as const };

  const ids = rows.map((r: { id: string }) => r.id);
  const { data: incidents } = await supabase
    .from("incidents")
    .select("change_event_id")
    .in("change_event_id", ids)
    .not("change_event_id", "is", null);

  const incidentSet = new Set(
    (incidents ?? []).map((i: { change_event_id: string }) => i.change_event_id).filter(Boolean)
  );

  const trainRows: Array<{ y: 0 | 1; x: Record<string, number> }> = [];

  for (const c of rows) {
    const det = await evaluateDeterministicRules(supabase, { orgId, changeId: (c as { id: string }).id });
    const signalKeys: string[] = (det as { detectedSignals?: string[] }).detectedSignals ?? [];
    const x = featuresForChange({
      change: c as { estimated_mrr_affected?: number | null; percent_customer_base_affected?: number | null },
      domainKey,
      signalKeys,
    });
    const y: 0 | 1 = incidentSet.has((c as { id: string }).id) ? 1 : 0;
    trainRows.push({ x, y });
  }

  const model = trainLogReg(trainRows, {
    lr: 0.15,
    steps: 450,
    l2: 0.02,
    maxFeatures: 220,
  });

  if (!model) return { trained: false, reason: "trainer_returned_null" as const };

  const { error: upErr } = await supabase.from("org_models").upsert(
    {
      org_id: orgId,
      domain: domainKey,
      model_key: "LOGREG_V1",
      coefficients: {
        intercept: model.intercept,
        weights: model.weights,
        features: model.features,
      },
      trained_at: model.trainedAt,
      metrics: model.metrics,
    },
    { onConflict: "org_id,domain,model_key" }
  );

  if (upErr) throw new Error(upErr.message);

  return { trained: true, metrics: model.metrics };
}
