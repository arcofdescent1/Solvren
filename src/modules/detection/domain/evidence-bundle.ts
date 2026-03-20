/**
 * Phase 4 — Evidence bundle standard (§12).
 */
export type EvidenceBundleInput = {
  headline: string;
  detector_reason: string;
  why_now: string;
  entities?: Array<{ entityType: string; entityId?: string; displayName?: string }>;
  signal_references?: Array<{ signalId: string; signalKey: string; signalTime: string }>;
  timeline?: Array<{ event: string; timestamp: string; detail?: string }>;
  thresholds_crossed?: Array<{ threshold: string; value: unknown; limit?: unknown }>;
  coverage_notes?: string;
  confidence_explanation?: string;
  recommended_actions?: string[];
  supporting_metrics?: Record<string, unknown>;
  lineage_refs?: string[];
};

export function buildEvidenceBundle(input: EvidenceBundleInput): Record<string, unknown> {
  return {
    headline: input.headline,
    detector_reason: input.detector_reason,
    why_now: input.why_now,
    entities: input.entities ?? [],
    signal_references: input.signal_references ?? [],
    timeline: input.timeline ?? [],
    thresholds_crossed: input.thresholds_crossed ?? [],
    coverage_notes: input.coverage_notes ?? null,
    confidence_explanation: input.confidence_explanation ?? null,
    recommended_actions: input.recommended_actions ?? [],
    supporting_metrics: input.supporting_metrics ?? {},
    lineage_refs: input.lineage_refs ?? [],
  };
}
