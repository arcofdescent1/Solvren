import type { SupabaseClient } from "@supabase/supabase-js";
import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { getReadyStatus } from "@/services/risk/readyStatus";
import { evaluateEvidenceStatus } from "@/services/evidence";
import { deriveReadinessRows } from "@/lib/executive/readinessDerivation";
import type { ReadinessWeights } from "./types";
import { scoreToLevel, type ReadinessLevel } from "./types";
import { parseReadinessWeights, validateWeightsTotal100 } from "./weights";
import { DEFAULT_READINESS_WEIGHTS } from "./types";

function riskBucketDimensionScore(bucket: string | null): number {
  const u = String(bucket ?? "MEDIUM").toUpperCase();
  if (u.includes("CRITICAL") || u.includes("CATASTROPHIC")) return 20;
  if (u === "HIGH" || u.includes("VERY")) return 45;
  if (u === "MEDIUM" || u === "MODERATE") return 70;
  if (u === "LOW") return 100;
  return 65;
}

function weightedAverage(weights: ReadinessWeights, dims: Record<keyof ReadinessWeights, number>): number {
  const w = validateWeightsTotal100(weights) ? weights : DEFAULT_READINESS_WEIGHTS;
  let sum = 0;
  (Object.keys(w) as (keyof ReadinessWeights)[]).forEach((k) => {
    sum += (w[k] / 100) * Math.max(0, Math.min(100, dims[k]));
  });
  return Math.round(Math.max(0, Math.min(100, sum)));
}

export type ChangeReadinessResult = {
  score: number;
  level: ReadinessLevel;
  dimensions: Record<keyof ReadinessWeights, number>;
  weights: ReadinessWeights;
};

/**
 * Phase 5 change-level readiness (0–100) from governance/evidence/approvals/risk/blockers/history proxies.
 */
export async function calculateChangeReadiness(
  supabase: SupabaseClient,
  args: {
    changeId: string;
    weightsJson?: unknown;
  }
): Promise<ChangeReadinessResult | null> {
  const { changeId } = args;
  let ready;
  try {
    ready = await getReadyStatus(supabase, { changeId });
  } catch {
    return null;
  }

  const { data: change } = await scopeActiveChangeEvents(
    supabase
      .from("change_events")
      .select("id, org_id, revenue_at_risk, failed_launch_labeled_at")
  )
    .eq("id", changeId)
    .maybeSingle();
  if (!change) return null;

  let evidenceProvided = 0;
  try {
    const ev = await evaluateEvidenceStatus(supabase, changeId);
    const req = ev.items.filter((i) => i.severity === "REQUIRED");
    const ok = req.filter((i) => i.status === "PROVIDED" || i.status === "WAIVED").length;
    evidenceProvided = req.length > 0 ? Math.round((ok / req.length) * 100) : 100;
  } catch {
    const reqCount = ready.missingEvidence.length + (ready.ready ? 1 : 0);
    evidenceProvided =
      reqCount === 0
        ? 100
        : Math.max(
            0,
            Math.round(
              (100 * (reqCount - ready.missingEvidence.length)) / Math.max(1, reqCount + ready.missingEvidence.length)
            )
          );
  }

  const missAp = ready.missingApprovals ?? [];
  const totalApSlots = missAp.reduce((a, m) => a + m.missing, 0);
  const approvalsScore =
    totalApSlots === 0 ? 100 : Math.max(0, 100 - Math.min(100, totalApSlots * 20));

  const riskScore = riskBucketDimensionScore(ready.bucket);

  const { data: approvals } = await supabase
    .from("approvals")
    .select("approval_area, decision, decided_at")
    .eq("change_event_id", changeId);

  const evidenceKinds = new Set<string>();
  try {
    const ev = await evaluateEvidenceStatus(supabase, changeId);
    for (const item of ev.items) {
      if (item.status === "PROVIDED" || item.status === "WAIVED") {
        evidenceKinds.add(String(item.kind ?? "").toUpperCase());
      }
    }
  } catch {
    /* use empty */
  }

  const coordErrors = ready.coordinationBlockingErrors ?? [];
  const blockers = coordErrors.map((title) => ({ title, severity: "ERROR" as const }));
  const rows = deriveReadinessRows({
    approvals: (approvals ?? []) as { approval_area: string | null; decision: string | null }[],
    evidenceKinds,
    coordinationBlockers: blockers,
  });
  const rollbackRow = rows.find((r) => r.category === "Rollback Plan");
  const rollbackScore =
    rollbackRow?.status === "READY" ? 100 : rollbackRow?.status === "BLOCKED" ? 25 : 55;

  const depCount = coordErrors.length + (ready.blockingIncidents?.length ?? 0);
  const dependenciesScore = Math.max(0, 100 - Math.min(100, depCount * 18));

  let historicalScore = 88;
  if (change.failed_launch_labeled_at) historicalScore = 25;
  else if ((ready.blockingIncidents ?? []).length > 0) historicalScore = 45;

  const weights = parseReadinessWeights(args.weightsJson);
  const dimensions = {
    evidence: evidenceProvided,
    approvals: approvalsScore,
    risk: riskScore,
    rollback: rollbackScore,
    dependencies: dependenciesScore,
    historical: historicalScore,
  };

  const score = weightedAverage(weights, dimensions);
  return {
    score,
    level: scoreToLevel(score),
    dimensions,
    weights,
  };
}

export async function loadOrgReadinessWeights(
  supabase: SupabaseClient,
  orgId: string
): Promise<ReadinessWeights> {
  const { data } = await supabase
    .from("organization_settings")
    .select("readiness_dimension_weights")
    .eq("org_id", orgId)
    .maybeSingle();
  return parseReadinessWeights((data as { readiness_dimension_weights?: unknown } | null)?.readiness_dimension_weights);
}
