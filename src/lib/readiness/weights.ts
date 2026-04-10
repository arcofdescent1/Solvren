import type { ReadinessWeights } from "./types";
import { DEFAULT_READINESS_WEIGHTS } from "./types";

export function parseReadinessWeights(raw: unknown): ReadinessWeights {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_READINESS_WEIGHTS };
  const o = raw as Record<string, unknown>;
  const w: ReadinessWeights = {
    evidence: Number(o.evidence ?? DEFAULT_READINESS_WEIGHTS.evidence),
    approvals: Number(o.approvals ?? DEFAULT_READINESS_WEIGHTS.approvals),
    risk: Number(o.risk ?? DEFAULT_READINESS_WEIGHTS.risk),
    rollback: Number(o.rollback ?? DEFAULT_READINESS_WEIGHTS.rollback),
    dependencies: Number(o.dependencies ?? DEFAULT_READINESS_WEIGHTS.dependencies),
    historical: Number(o.historical ?? DEFAULT_READINESS_WEIGHTS.historical),
  };
  return w;
}

export function validateWeightsTotal100(w: ReadinessWeights): boolean {
  const sum =
    w.evidence +
    w.approvals +
    w.risk +
    w.rollback +
    w.dependencies +
    w.historical;
  return Math.round(sum) === 100;
}
