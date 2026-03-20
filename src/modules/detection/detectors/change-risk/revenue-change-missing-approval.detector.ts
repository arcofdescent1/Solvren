/**
 * Phase 4 — Detector D1: Revenue-impacting change missing required approval (§15.4).
 */
import type { IDetector } from "../base/detector.interface";
import type { DetectorContext } from "../base/detector-context";
import type { DetectionResult } from "../../domain/detection-result";
import { actionableFinding, noFinding } from "../base/detector-result";

const DETECTOR_KEY = "change.revenue_change_missing_approval";
const VERSION = "1.0";

export class RevenueChangeMissingApprovalDetector implements IDetector {
  readonly detectorKey = DETECTOR_KEY;
  readonly detectorVersion = VERSION;

  async evaluate(ctx: DetectorContext): Promise<DetectionResult> {
    const submitted = ctx.signals.filter((s) => s.signal_key === "change_submitted");
    const approved = ctx.signals.filter((s) => s.signal_key === "change_approved");
    if (submitted.length === 0) return noFinding("none", "none");

    for (const sig of submitted) {
      const changeId = (sig.references_json as Record<string, string>)?.change_id ?? sig.source_ref ?? sig.id;
      const hasApproval = approved.some((a) => (a.references_json as Record<string, string>)?.change_id === changeId);
      if (hasApproval) continue;

      const dedupeKey = `change_missing_approval:${changeId}`;
      const groupingKey = `change:${changeId}`;
      return actionableFinding(dedupeKey, groupingKey, dedupeKey, 0.9, {
        headline: "Revenue-impacting change missing required approval",
        detector_reason: "Change reaches deployable state without required approvals.",
        why_now: "Approval matrix gap detected.",
        entities: sig.primary_canonical_entity_id ? [{ entityType: "change", entityId: sig.primary_canonical_entity_id }] : [],
        signal_references: [{ signalId: sig.id, signalKey: sig.signal_key, signalTime: sig.signal_time }],
        timeline: [{ event: "change_submitted", timestamp: sig.signal_time }],
      });
    }
    return noFinding("none", "none");
  }
}
