/**
 * Phase 4 — Detector C2: Opportunity missing source attribution (§15.3).
 */
import type { IDetector } from "../base/detector.interface";
import type { DetectorContext } from "../base/detector-context";
import type { DetectionResult } from "../../domain/detection-result";
import { actionableFinding, noFinding } from "../base/detector-result";

const DETECTOR_KEY = "data.opportunity_missing_source_attribution";
const VERSION = "1.0";

export class OpportunityMissingSourceAttributionDetector implements IDetector {
  readonly detectorKey = DETECTOR_KEY;
  readonly detectorVersion = VERSION;

  async evaluate(ctx: DetectorContext): Promise<DetectionResult> {
    const oppCreated = ctx.signals.filter((s) => s.signal_key === "opportunity_stage_changed" || s.signal_key === "deal_stage_changed");
    if (oppCreated.length === 0) return noFinding("none", "none");

    const window = ctx.detectorDefinition.evaluation_window_json as { grace_hours?: number };
    const graceHours = window.grace_hours ?? 72;

    for (const sig of oppCreated) {
      const dims = (sig.dimensions_json ?? {}) as Record<string, string>;
      const source = dims.source ?? dims.lead_source ?? dims.utm_source ?? dims.campaign ?? "";
      if (source && String(source).trim()) continue;

      const entityId = sig.primary_canonical_entity_id ?? sig.source_ref ?? sig.id;
      const createdTime = new Date(sig.signal_time).getTime();
      const ageHours = (Date.now() - createdTime) / 3600000;
      if (ageHours < graceHours) continue;

      const dedupeKey = `opp_missing_source:${entityId}`;
      const groupingKey = `opportunity:${entityId}`;
      return actionableFinding(dedupeKey, groupingKey, dedupeKey, 0.75, {
        headline: "Opportunity missing source attribution",
        detector_reason: "Required source/attribution fields absent after grace period.",
        why_now: `Opportunity created ${Math.round(ageHours)}h ago; grace period is ${graceHours}h.`,
        entities: entityId ? [{ entityType: "opportunity", entityId }] : [],
        signal_references: [{ signalId: sig.id, signalKey: sig.signal_key, signalTime: sig.signal_time }],
        timeline: [{ event: "opportunity_created", timestamp: sig.signal_time, detail: "Missing source fields" }],
        thresholds_crossed: [{ threshold: "grace_hours", value: ageHours, limit: graceHours }],
      });
    }
    return noFinding("none", "none");
  }
}
