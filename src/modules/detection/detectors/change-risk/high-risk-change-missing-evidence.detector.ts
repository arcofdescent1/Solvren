/**
 * Phase 4 — Detector D2: High-risk change missing evidence (§15.4).
 * Placeholder: requires change_created, change_evidence_missing signals.
 */
import type { IDetector } from "../base/detector.interface";
import type { DetectorContext } from "../base/detector-context";
import type { DetectionResult } from "../../domain/detection-result";
import { actionableFinding, noFinding } from "../base/detector-result";

const DETECTOR_KEY = "change.high_risk_change_missing_evidence";
const VERSION = "1.0";

export class HighRiskChangeMissingEvidenceDetector implements IDetector {
  readonly detectorKey = DETECTOR_KEY;
  readonly detectorVersion = VERSION;

  async evaluate(ctx: DetectorContext): Promise<DetectionResult> {
    const evidenceMissing = ctx.signals.filter((s) => s.signal_key === "change_evidence_missing");
    if (evidenceMissing.length === 0) return noFinding("none", "none");

    for (const sig of evidenceMissing) {
      const changeId = (sig.references_json as Record<string, string>)?.change_id ?? sig.source_ref ?? sig.id;
      const dedupeKey = `change_missing_evidence:${changeId}`;
      const groupingKey = `change:${changeId}`;
      return actionableFinding(dedupeKey, groupingKey, dedupeKey, 0.9, {
        headline: "High-risk change missing required evidence",
        detector_reason: "High-risk or revenue-impacting change lacks required documentation at gate.",
        why_now: "Evidence missing signal received.",
        entities: sig.primary_canonical_entity_id ? [{ entityType: "change", entityId: sig.primary_canonical_entity_id }] : [],
        signal_references: [{ signalId: sig.id, signalKey: sig.signal_key, signalTime: sig.signal_time }],
        timeline: [{ event: "change_evidence_missing", timestamp: sig.signal_time }],
      });
    }
    return noFinding("none", "none");
  }
}
