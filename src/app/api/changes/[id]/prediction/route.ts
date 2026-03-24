import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPredictionBadgeForChange } from "@/services/risk/predictionBadge";
import { exposureBucketFromChange } from "@/services/risk/exposureBuckets";
import { loadOrgModel, predictWithModel, blendBayesAndML } from "@/services/risk/ml/infer";
import { featuresForChange } from "@/services/risk/ml/features";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: changeId } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: change, error: chErr } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, org_id, domain, estimated_mrr_affected, percent_customer_base_affected"))
    .eq("id", changeId)
    .maybeSingle();

  if (chErr)
    return NextResponse.json({ error: chErr.message }, { status: 500 });
  if (!change)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("org_id", change.org_id)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member)
    return NextResponse.json(
      { error: "Not a member of this organization" },
      { status: 403 }
    );

  const domainKey = String(change.domain ?? "REVENUE");
  const orgId = String(change.org_id);
  const exposureBucket = exposureBucketFromChange(change);

  const { data: signals } = await supabase
    .from("risk_signals")
    .select("signal_key, weight_at_time")
    .eq("change_event_id", changeId);

  const detectedSignals =
    (signals ?? []).map((s) => ({
      signalKey: String(s.signal_key),
      weight: s.weight_at_time ?? null,
    })) ?? [];

  const badge = await getPredictionBadgeForChange(supabase, {
    orgId,
    changeId,
    domainKey,
    detectedSignals,
    exposureBucket,
  });

  const signalKeys = detectedSignals.map((s) => s.signalKey);
  const model = await loadOrgModel(supabase, { orgId, domainKey });

  let mlProb: number | null = null;
  let mlMetrics: { sampleSize?: number; posRate?: number; loss?: number; brier?: number } | null = null;

  if (model) {
    const x = featuresForChange({
      change,
      domainKey,
      signalKeys,
    });
    mlProb = predictWithModel(model, x);
    mlMetrics = model.metrics;
  }

  const blended = blendBayesAndML({
    bayesMean: badge.mean,
    bayesConfidence: badge.confidence,
    mlProb,
    mlSampleSize: mlMetrics?.sampleSize ?? null,
  });

  return NextResponse.json({
    ok: true,
    domainKey,
    exposureBucket,
    detectedSignals,
    bayes: badge,
    ml: mlProb,
    blended,
    mlMetrics: mlMetrics ?? undefined,
  });
}
