/**
 * Phase 4 — Detector C4: Workflow sync drift detected (§15.3).
 * Placeholder: requires workflow_sync_drift_detected / field_sync_conflict_detected signals.
 */
import type { IDetector } from "../base/detector.interface";
import type { DetectorContext } from "../base/detector-context";
import type { DetectionResult } from "../../domain/detection-result";
import { actionableFinding, noFinding } from "../base/detector-result";

const DETECTOR_KEY = "data.workflow_sync_drift_detected";
const VERSION = "1.0";

export class WorkflowSyncDriftDetector implements IDetector {
  readonly detectorKey = DETECTOR_KEY;
  readonly detectorVersion = VERSION;

  async evaluate(ctx: DetectorContext): Promise<DetectionResult> {
    const driftSignals = ctx.signals.filter(
      (s) => s.signal_key === "workflow_sync_drift_detected" || s.signal_key === "field_sync_conflict_detected"
    );
    if (driftSignals.length === 0) return noFinding("none", "none");

    const defaults = ctx.detectorDefinition.threshold_defaults_json as { min_conflict_count?: number };
    const minCount = defaults?.min_conflict_count ?? 2;
    if (driftSignals.length < minCount) return noFinding("none", "none");

    const dedupeKey = `sync_drift:${Math.floor(Date.now() / 86400000)}`;
    const groupingKey = "workflow";
    return actionableFinding(dedupeKey, groupingKey, dedupeKey, 0.85, {
      headline: `${driftSignals.length} sync conflicts/drift in rolling window`,
      detector_reason: "Repeated sync conflicts or drift for mapped records.",
      why_now: `Conflict count (${driftSignals.length}) exceeds threshold (${minCount}).`,
      signal_references: driftSignals.slice(0, 5).map((s) => ({ signalId: s.id, signalKey: s.signal_key, signalTime: s.signal_time })),
      timeline: driftSignals.slice(0, 5).map((s) => ({ event: s.signal_key, timestamp: s.signal_time })),
      thresholds_crossed: [{ threshold: "min_conflict_count", value: driftSignals.length, limit: minCount }],
    });
  }
}
