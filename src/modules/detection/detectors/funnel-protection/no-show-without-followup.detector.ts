/**
 * Phase 4 — Detector B4: No-show without follow-up (§15.2).
 */
import type { IDetector } from "../base/detector.interface";
import type { DetectorContext } from "../base/detector-context";
import type { DetectionResult } from "../../domain/detection-result";
import { actionableFinding, noFinding } from "../base/detector-result";

const DETECTOR_KEY = "funnel.no_show_without_followup";
const VERSION = "1.0";

export class NoShowWithoutFollowupDetector implements IDetector {
  readonly detectorKey = DETECTOR_KEY;
  readonly detectorVersion = VERSION;

  async evaluate(ctx: DetectorContext): Promise<DetectionResult> {
    const noShows = ctx.signals.filter((s) => s.signal_key === "meeting_no_show");
    if (noShows.length === 0) return noFinding("none", "none");

    const window = ctx.detectorDefinition.evaluation_window_json as { recovery_hours?: number };
    const recoveryHours = window.recovery_hours ?? 24;

    for (const sig of noShows) {
      const entityId = sig.primary_canonical_entity_id ?? sig.source_ref ?? sig.id;
      const noShowTime = new Date(sig.signal_time).getTime();
      const cutoff = Date.now() - recoveryHours * 60 * 60 * 1000;
      if (noShowTime > cutoff) continue;

      const hasFollowUp = ctx.signals.some((s) => {
        if (s.signal_key !== "task_created" && s.signal_key !== "meeting_booked" && s.signal_key !== "meeting_canceled") return false;
        const tTime = new Date(s.signal_time).getTime();
        return tTime > noShowTime && (s.primary_canonical_entity_id === entityId || s.source_ref === entityId);
      });
      if (hasFollowUp) continue;

      const dedupeKey = `no_show_no_followup:${entityId}:${Math.floor(noShowTime / 3600000)}`;
      const groupingKey = `meeting:${entityId}`;
      const hoursSince = Math.round((Date.now() - noShowTime) / 3600000);
      return actionableFinding(dedupeKey, groupingKey, dedupeKey, 0.85, {
        headline: `No-show without follow-up for ${hoursSince}h`,
        detector_reason: "No recovery action (task, reschedule) within window after no-show.",
        why_now: `No-show occurred ${hoursSince}h ago; recovery window is ${recoveryHours}h.`,
        entities: entityId ? [{ entityType: "meeting", entityId }] : [],
        signal_references: [{ signalId: sig.id, signalKey: sig.signal_key, signalTime: sig.signal_time }],
        timeline: [{ event: "meeting_no_show", timestamp: sig.signal_time }],
        thresholds_crossed: [{ threshold: "recovery_hours", value: hoursSince, limit: recoveryHours }],
      });
    }
    return noFinding("none", "none");
  }
}
