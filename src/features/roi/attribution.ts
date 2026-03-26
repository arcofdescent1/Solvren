import type { RoiConfidence } from "./types";

export function computeImpactBoundary(args: {
  completionTimeMs?: number | null;
  incidentTimeMs?: number | null;
}) {
  const completion = args.completionTimeMs ?? Number.POSITIVE_INFINITY;
  const incident = args.incidentTimeMs ?? Number.POSITIVE_INFINITY;
  return Math.min(completion, incident);
}

export function qualifiesLikelyPrevented(args: {
  interventionTimeMs?: number | null;
  impactBoundaryTimeMs: number;
  incidentTimeMs?: number | null;
  nowMs: number;
  noIncidentWindowMs?: number;
}) {
  const windowMs = args.noIncidentWindowMs ?? 14 * 24 * 60 * 60 * 1000;
  const intervention = args.interventionTimeMs ?? null;
  if (intervention == null) return false;
  if (intervention >= args.impactBoundaryTimeMs) return false;
  const incident = args.incidentTimeMs ?? Number.POSITIVE_INFINITY;
  if (incident < intervention + windowMs) return false;
  return args.nowMs >= intervention + windowMs;
}

export function confidenceRank(c: RoiConfidence) {
  if (c === "confirmed_resolved") return 4;
  if (c === "likely_prevented") return 3;
  if (c === "observed") return 2;
  return 1;
}
