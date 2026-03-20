/**
 * Phase 4 — Detector result helpers.
 */
import type { DetectionResult, EvidenceBundle } from "../../domain/detection-result";
import { buildEvidenceBundle } from "../../domain/evidence-bundle";

export function noFinding(dedupeKey: string, groupingKey: string): DetectionResult {
  return {
    evaluationStatus: "ok",
    conditionsMatched: false,
    confidenceScore: 0,
    evidenceBundle: buildEvidenceBundle({
      headline: "No detection",
      detector_reason: "Conditions not met",
      why_now: "Evaluation completed without match",
    }) as EvidenceBundle,
    groupingKey,
    dedupeKey,
    proposedIssueFingerprint: dedupeKey,
  };
}

export function suppressedFinding(
  dedupeKey: string,
  groupingKey: string,
  reasons: string[],
  evidence: Partial<EvidenceBundle>
): DetectionResult {
  return {
    evaluationStatus: "ok",
    conditionsMatched: true,
    confidenceScore: evidence.confidence_explanation ? 0.5 : 0,
    evidenceBundle: buildEvidenceBundle({
      headline: evidence.headline ?? "Suppressed",
      detector_reason: evidence.detector_reason ?? "Suppression applied",
      why_now: evidence.why_now ?? reasons.join("; "),
      ...evidence,
    }) as EvidenceBundle,
    groupingKey,
    dedupeKey,
    proposedIssueFingerprint: dedupeKey,
    suppressionReasons: reasons,
  };
}

export function actionableFinding(
  dedupeKey: string,
  groupingKey: string,
  fingerprint: string,
  confidence: number,
  evidence: Partial<EvidenceBundle>,
  severityOverride?: string
): DetectionResult {
  return {
    evaluationStatus: "ok",
    conditionsMatched: true,
    confidenceScore: confidence,
    evidenceBundle: buildEvidenceBundle({
      headline: evidence.headline ?? "Actionable detection",
      detector_reason: evidence.detector_reason ?? "Conditions met",
      why_now: evidence.why_now ?? "Threshold crossed",
      ...evidence,
    }) as EvidenceBundle,
    groupingKey,
    dedupeKey,
    proposedIssueFingerprint: fingerprint,
    severityOverride,
  };
}
