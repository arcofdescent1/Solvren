/**
 * Phase 4 — Detection result (§7.2).
 */
export type FindingStatus = "candidate" | "suppressed" | "actionable" | "issue_created" | "closed_no_issue";

export type DetectionResult = {
  evaluationStatus: "ok" | "error";
  conditionsMatched: boolean;
  confidenceScore: number;
  evidenceBundle: EvidenceBundle;
  groupingKey: string;
  dedupeKey: string;
  proposedIssueFingerprint: string;
  severityOverride?: string;
  suppressionReasons?: string[];
  debugTrace?: Record<string, unknown>;
};

export type EvidenceBundle = {
  headline: string;
  detector_reason: string;
  why_now: string;
  entities: Array<{ entityType: string; entityId?: string; displayName?: string }>;
  signal_references: Array<{ signalId: string; signalKey: string; signalTime: string }>;
  timeline: Array<{ event: string; timestamp: string; detail?: string }>;
  thresholds_crossed: Array<{ threshold: string; value: unknown; limit?: unknown }>;
  coverage_notes?: string;
  confidence_explanation?: string;
  recommended_actions?: string[];
  supporting_metrics?: Record<string, unknown>;
  lineage_refs?: string[];
};
