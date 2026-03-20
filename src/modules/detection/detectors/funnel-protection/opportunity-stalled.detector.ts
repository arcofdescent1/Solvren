/**
 * Phase 4 — Detector B2: Opportunity stalled in stage (§15.2).
 */
import type { IDetector } from "../base/detector.interface";
import type { DetectorContext } from "../base/detector-context";
import type { DetectionResult } from "../../domain/detection-result";
import { actionableFinding, noFinding } from "../base/detector-result";

const DETECTOR_KEY = "funnel.opportunity_stalled_in_stage";
const VERSION = "1.0";

export class OpportunityStalledDetector implements IDetector {
  readonly detectorKey = DETECTOR_KEY;
  readonly detectorVersion = VERSION;

  async evaluate(ctx: DetectorContext): Promise<DetectionResult> {
    const stageSignals = ctx.signals.filter(
      (s) => s.signal_key === "opportunity_stage_changed" || s.signal_key === "deal_stage_changed"
    );
    if (stageSignals.length === 0) return noFinding("none", "none");

    const window = ctx.detectorDefinition.evaluation_window_json as { sla_days?: number };
    const slaDays = window.sla_days ?? 14;

    for (const sig of stageSignals) {
      const entityId = sig.primary_canonical_entity_id ?? sig.source_ref ?? sig.id;
      const stageTime = new Date(sig.signal_time).getTime();
      const ageDays = (Date.now() - stageTime) / (24 * 60 * 60 * 1000);
      if (ageDays < slaDays) continue;

      const dims = (sig.dimensions_json ?? {}) as Record<string, string>;
      const stage = dims.stage ?? dims.new_stage ?? "unknown";
      const amount = (sig.measures_json as Record<string, number>)?.amount ?? 0;

      const dedupeKey = `opportunity_stalled:${entityId}:${stage}`;
      const groupingKey = `opportunity:${entityId}`;
      return actionableFinding(dedupeKey, groupingKey, dedupeKey, 0.85, {
        headline: `Opportunity stalled in ${stage} for ${Math.round(ageDays)} days`,
        detector_reason: "Opportunity has not moved from current stage within SLA.",
        why_now: `Stage age (${Math.round(ageDays)} days) exceeds SLA (${slaDays} days).`,
        entities: entityId ? [{ entityType: "opportunity", entityId }] : [],
        signal_references: [{ signalId: sig.id, signalKey: sig.signal_key, signalTime: sig.signal_time }],
        timeline: [{ event: "stage_changed", timestamp: sig.signal_time, detail: `Stage: ${stage}, Amount: $${amount}` }],
        thresholds_crossed: [{ threshold: "sla_days", value: ageDays, limit: slaDays }],
      });
    }
    return noFinding("none", "none");
  }
}
