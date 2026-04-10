import type { SupabaseClient } from "@supabase/supabase-js";
import { getReadyStatus } from "@/services/risk/readyStatus";
import type { PredictionType } from "./predictionTypes";
import type { ChangeReadinessResult } from "./calculateChangeReadiness";

type ResolveCtx = {
  ready: Awaited<ReturnType<typeof getReadyStatus>>;
  readiness: ChangeReadinessResult;
  priorScore: number | null;
};

const AUTO_RESOLVES: Record<PredictionType, ((ctx: ResolveCtx) => boolean) | null> = {
  MISSING_EVIDENCE_DELAY: ({ ready }) => ready.missingEvidence.length === 0 && !ready.approvalBlockedMissingEvidence,
  APPROVAL_SLA_RISK: ({ ready }) => (ready.missingApprovals ?? []).every((m) => m.missing === 0),
  DEPLOYMENT_BLOCKER_RISK: ({ ready }) =>
    (ready.blockingIncidents?.length ?? 0) === 0 && (ready.coordinationBlockingErrors?.length ?? 0) === 0,
  ROLLBACK_RISK: ({ readiness }) => readiness.dimensions.rollback >= 85,
  REVENUE_IMPACT_UNDERESTIMATED: (_ctx: ResolveCtx) => false /* expires only */,
  DEPENDENCY_DELAY_RISK: ({ ready }) =>
    (ready.coordinationBlockingErrors?.length ?? 0) === 0 &&
    (ready.missingApprovals?.reduce((a, m) => a + m.missing, 0) ?? 0) <= 1,
  HISTORICAL_FAILURE_MATCH: null,
  READINESS_DETERIORATING: ({ readiness, priorScore }) => {
    if (priorScore == null) return false;
    return readiness.score >= priorScore - 5;
  },
};

/**
 * Mark ACTIVE predictions RESOLVED when their root cause clears (per Phase 5 matrix).
 */
export async function autoResolvePredictionsForChange(
  supabase: SupabaseClient,
  args: {
    orgId: string;
    changeId: string;
    readiness: ChangeReadinessResult;
    priorReadinessScore?: number | null;
  }
): Promise<void> {
  const { orgId, changeId, readiness, priorReadinessScore } = args;
  let ready;
  try {
    ready = await getReadyStatus(supabase, { changeId });
  } catch {
    return;
  }

  const { data: active } = await supabase
    .from("predicted_risk_events")
    .select("id, prediction_type")
    .eq("org_id", orgId)
    .eq("change_event_id", changeId)
    .eq("status", "ACTIVE");

  const nowIso = new Date().toISOString();
  for (const row of active ?? []) {
    const t = row.prediction_type as PredictionType;
    const fn = AUTO_RESOLVES[t];
    if (fn == null) continue;
    const ok = fn({ ready, readiness, priorScore: priorReadinessScore ?? null });
    if (ok) {
      await supabase
        .from("predicted_risk_events")
        .update({ status: "RESOLVED", resolved_at: nowIso })
        .eq("id", row.id as string);
    }
  }
}
