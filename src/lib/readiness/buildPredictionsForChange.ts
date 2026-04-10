import type { SupabaseClient } from "@supabase/supabase-js";
import { getReadyStatus } from "@/services/risk/readyStatus";
import type { PredictionType } from "./predictionTypes";
import type { PredictionExplanationV1 } from "./types";
import { rootCauseHash } from "./rootCauseHash";
import type { ChangeReadinessResult } from "./calculateChangeReadiness";

export type BuiltPrediction = {
  prediction_type: PredictionType;
  root_cause_hash: string;
  confidence_score: number;
  predicted_impact: string | null;
  explanation_json: PredictionExplanationV1;
};

function explanation(
  partial: Omit<PredictionExplanationV1, "schemaVersion">
): PredictionExplanationV1 {
  return { schemaVersion: 1, ...partial };
}

function capConfidenceColdStart(conf: number, sampleSize: number): number {
  if (sampleSize < 3) return Math.min(conf, 60);
  return conf;
}

/**
 * Rule-based + light historical signals for one change.
 */
export async function buildPredictionsForChange(
  supabase: SupabaseClient,
  args: {
    orgId: string;
    changeId: string;
    readiness: ChangeReadinessResult;
    expireDays: number;
  }
): Promise<BuiltPrediction[]> {
  const { orgId, changeId, readiness } = args;
  const out: BuiltPrediction[] = [];

  let ready;
  try {
    ready = await getReadyStatus(supabase, { changeId });
  } catch {
    return out;
  }

  const now = Date.now();
  const ms24h = 24 * 60 * 60 * 1000;

  if (ready.missingEvidence.length > 0) {
    const h = rootCauseHash(["evidence", ...[...ready.missingEvidence].sort()]);
    out.push({
      prediction_type: "MISSING_EVIDENCE_DELAY",
      root_cause_hash: h,
      confidence_score: Math.min(92, 60 + ready.missingEvidence.length * 8),
      predicted_impact: "Approval delay",
      explanation_json: explanation({
        headline: "Missing evidence likely to delay approval",
        bullets: ready.missingEvidence.slice(0, 4).map((k) => `Required evidence not satisfied: ${k}`),
        signals: [{ type: "missing_evidence", weight: 0.4 }],
        historicalComparison: {
          sampleSize: 0,
          matchRate: 0,
          summary: "Insufficient history available",
        },
        confidence: 0,
      }),
    });
    const last = out[out.length - 1];
    const c = capConfidenceColdStart(last.confidence_score, 0);
    last.confidence_score = c;
    last.explanation_json.confidence = c;
  }

  const rollbackRowPending =
    readiness.dimensions.rollback < 80;
  if (rollbackRowPending) {
    const h = rootCauseHash(["rollback"]);
    out.push({
      prediction_type: "ROLLBACK_RISK",
      root_cause_hash: h,
      confidence_score: 72,
      predicted_impact: "Operational risk",
      explanation_json: explanation({
        headline: "Rollback plan not ready",
        bullets: ["Rollback readiness category is not green."],
        signals: [{ type: "missing_rollback_plan", weight: 0.35 }],
        historicalComparison: {
          sampleSize: 0,
          matchRate: 0,
          summary: "Insufficient history available",
        },
        confidence: 60,
      }),
    });
  }

  if ((ready.blockingIncidents?.length ?? 0) > 0 || (ready.coordinationBlockingErrors?.length ?? 0) > 0) {
    const h = rootCauseHash(["blocker", String(ready.blockingIncidents?.length ?? 0)]);
    out.push({
      prediction_type: "DEPLOYMENT_BLOCKER_RISK",
      root_cause_hash: h,
      confidence_score: Math.min(90, 55 + (ready.blockingIncidents?.length ?? 0) * 12),
      predicted_impact: "Launch blocker",
      explanation_json: explanation({
        headline: "Deployment blocker likely",
        bullets: [
          ...(ready.coordinationBlockingErrors ?? []).slice(0, 3).map((e) => `Coordination: ${e}`),
          ...(ready.blockingIncidents?.length
            ? [`${ready.blockingIncidents.length} open incident(s)`]
            : []),
        ],
        signals: [{ type: "open_blockers", weight: 0.45 }],
        historicalComparison: {
          sampleSize: 0,
          matchRate: 0,
          summary: "Insufficient history available",
        },
        confidence: 60,
      }),
    });
    const p = out[out.length - 1];
    p.confidence_score = capConfidenceColdStart(p.confidence_score, 0);
    p.explanation_json.confidence = p.confidence_score;
  }

  const depSignals =
    (ready.coordinationBlockingErrors?.length ?? 0) +
    (ready.missingApprovals?.reduce((a, m) => a + m.missing, 0) ?? 0);
  if (depSignals > 2) {
    const h = rootCauseHash(["deps", String(depSignals)]);
    out.push({
      prediction_type: "DEPENDENCY_DELAY_RISK",
      root_cause_hash: h,
      confidence_score: Math.min(88, 50 + depSignals * 6),
      predicted_impact: "Schedule slip",
      explanation_json: explanation({
        headline: "Cross-team dependency may delay release",
        bullets: [`${depSignals} dependency signals pending`],
        signals: [{ type: "unresolved_dependencies", weight: 0.3 }],
        historicalComparison: {
          sampleSize: 0,
          matchRate: 0,
          summary: "Insufficient history available",
        },
        confidence: 60,
      }),
    });
  }

  const { data: change } = await supabase
    .from("change_events")
    .select("due_at, revenue_at_risk")
    .eq("id", changeId)
    .maybeSingle();
  const dueAt = change?.due_at ? new Date(change.due_at as string).getTime() : null;
  const dueSoon = dueAt != null && dueAt > now && dueAt <= now + ms24h;

    const { data: pendingApprs } = await supabase
    .from("approvals")
    .select("id, approver_user_id, decision")
    .eq("org_id", orgId)
    .eq("change_event_id", changeId)
    .eq("decision", "PENDING");

  if (dueSoon && (pendingApprs ?? []).length > 0) {
    const approverId = String((pendingApprs![0] as { approver_user_id?: string }).approver_user_id ?? "");
    let lateCount = 0;
    let total = 0;
    if (approverId) {
      const { data: past } = await supabase
        .from("approvals")
        .select("id, decided_at, change_event_id")
        .eq("approver_user_id", approverId)
        .eq("org_id", orgId)
        .not("decided_at", "is", null)
        .order("decided_at", { ascending: false })
        .limit(10);
      for (const row of past ?? []) {
        total += 1;
        const { data: ce } = await supabase
          .from("change_events")
          .select("due_at")
          .eq("id", (row as { change_event_id: string }).change_event_id)
          .maybeSingle();
        const d = ce?.due_at ? new Date(ce.due_at as string).getTime() : null;
        const dec = (row as { decided_at: string }).decided_at
          ? new Date((row as { decided_at: string }).decided_at).getTime()
          : null;
        if (d && dec && dec > d) lateCount += 1;
      }
    }
    if (total >= 3 && lateCount >= 3) {
      const h = rootCauseHash(["sla", approverId]);
      out.push({
        prediction_type: "APPROVAL_SLA_RISK",
        root_cause_hash: h,
        confidence_score: Math.min(90, 65 + lateCount * 3),
        predicted_impact: "SLA miss",
        explanation_json: explanation({
          headline: "Approval likely to miss SLA",
          bullets: [
            `Approver missed deadline on ${lateCount} of last ${total} decisions`,
            "Change due window within 24 hours",
          ],
          signals: [{ type: "approver_sla_history", weight: 0.4 }],
          historicalComparison: {
            sampleSize: total,
            matchRate: lateCount / Math.max(1, total),
            summary: `${lateCount} of last ${total} approvals were late after due date`,
          },
          confidence: 0,
        }),
      });
      const p = out[out.length - 1];
      p.confidence_score = capConfidenceColdStart(p.confidence_score, total);
      p.explanation_json.confidence = p.confidence_score;
    }
  }

  const bucket = String(ready.bucket ?? "MEDIUM").toUpperCase();
  const rev = Number((change as { revenue_at_risk?: number })?.revenue_at_risk ?? 0);
  if ((bucket === "HIGH" || bucket === "CRITICAL") && rev < 5000) {
    const h = rootCauseHash(["revenue_low", bucket]);
    out.push({
      prediction_type: "REVENUE_IMPACT_UNDERESTIMATED",
      root_cause_hash: h,
      confidence_score: 62,
      predicted_impact: "Revenue exposure",
      explanation_json: explanation({
        headline: "Revenue impact may be underestimated",
        bullets: [`Risk bucket is ${bucket} but recorded revenue at risk is low.`],
        signals: [{ type: "risk_revenue_mismatch", weight: 0.25 }],
        historicalComparison: {
          sampleSize: 0,
          matchRate: 0,
          summary: "Insufficient history available",
        },
        confidence: 60,
      }),
    });
  }

  const { data: similar } = await supabase
    .from("change_events")
    .select("id, failed_launch_labeled_at, status")
    .eq("org_id", orgId)
    .neq("id", changeId)
    .limit(40);

  const failed = (similar ?? []).filter(
    (r) =>
      (r as { failed_launch_labeled_at?: string | null }).failed_launch_labeled_at ||
      String((r as { status?: string }).status).toUpperCase() === "REJECTED"
  );
  if (failed.length >= 3) {
    const h = rootCauseHash(["hist", "domain_pattern"]);
    const sampleSize = failed.length;
    out.push({
      prediction_type: "HISTORICAL_FAILURE_MATCH",
      root_cause_hash: h,
      confidence_score: capConfidenceColdStart(70, sampleSize),
      predicted_impact: "Pattern risk",
      explanation_json: explanation({
        headline: "Historical pattern similar to failed launches",
        bullets: [`${sampleSize} comparable changes had failure signals in this org.`],
        signals: [{ type: "historical_failure_pattern", weight: 0.33 }],
        historicalComparison: {
          sampleSize,
          matchRate: 0.65,
          summary: `${sampleSize} historical changes with failure labels or rejection`,
        },
        confidence: 0,
      }),
    });
    const p = out[out.length - 1];
    p.explanation_json.confidence = p.confidence_score;
  }

  const { data: snap } = await supabase
    .from("readiness_snapshots")
    .select("readiness_score, captured_at")
    .eq("org_id", orgId)
    .eq("scope_type", "CHANGE")
    .eq("scope_id", changeId)
    .gte("captured_at", new Date(now - 7 * 86400000).toISOString())
    .order("captured_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (snap && typeof snap.readiness_score === "number") {
    const prev = Number(snap.readiness_score);
    if (readiness.score + 10 <= prev) {
      const h = rootCauseHash(["deteriorate", String(prev), String(readiness.score)]);
      out.push({
        prediction_type: "READINESS_DETERIORATING",
        root_cause_hash: h,
        confidence_score: Math.min(85, 55 + (prev - readiness.score)),
        predicted_impact: "Readiness",
        explanation_json: explanation({
          headline: "Release readiness deteriorating",
          bullets: [`Readiness fell from ${prev} to ${readiness.score} over the past week.`],
          signals: [{ type: "readiness_delta", weight: 0.5 }],
          historicalComparison: {
            sampleSize: 1,
            matchRate: 1,
            summary: "Compared to earliest snapshot in the last 7 days",
          },
          confidence: Math.min(85, 55 + (prev - readiness.score)),
        }),
      });
    }
  }

  return out;
}
