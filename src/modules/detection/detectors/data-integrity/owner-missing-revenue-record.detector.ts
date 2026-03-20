/**
 * Phase 4 — Detector C3: Owner missing on revenue-critical records (§15.3).
 * Uses contact/deal signals with dimensions indicating missing owner.
 */
import type { IDetector } from "../base/detector.interface";
import type { DetectorContext } from "../base/detector-context";
import type { DetectionResult } from "../../domain/detection-result";
import { actionableFinding, noFinding } from "../base/detector-result";

const DETECTOR_KEY = "data.owner_missing_revenue_record";
const VERSION = "1.0";

export class OwnerMissingRevenueRecordDetector implements IDetector {
  readonly detectorKey = DETECTOR_KEY;
  readonly detectorVersion = VERSION;

  async evaluate(ctx: DetectorContext): Promise<DetectionResult> {
    const dealSignals = ctx.signals.filter((s) => s.signal_key === "deal_stage_changed" || s.signal_key === "opportunity_stage_changed");
    const contactSignals = ctx.signals.filter((s) => s.signal_key === "contact_created" || s.signal_key === "contact_updated");
    const all = [...dealSignals, ...contactSignals];
    if (all.length === 0) return noFinding("none", "none");

    const window = ctx.detectorDefinition.evaluation_window_json as { grace_hours?: number };
    const graceHours = window.grace_hours ?? 24;

    for (const sig of all) {
      const dims = (sig.dimensions_json ?? {}) as Record<string, string>;
      const owner = dims.owner ?? dims.owner_id ?? dims.hubspot_owner_id ?? "";
      if (owner && String(owner).trim()) continue;

      const entityId = sig.primary_canonical_entity_id ?? sig.source_ref ?? sig.id;
      const sigTime = new Date(sig.signal_time).getTime();
      const ageHours = (Date.now() - sigTime) / 3600000;
      if (ageHours < graceHours) continue;

      const objectType = sig.signal_key.includes("deal") || sig.signal_key.includes("opportunity") ? "deal" : "contact";
      const dedupeKey = `owner_missing:${objectType}:${entityId}`;
      const groupingKey = `${objectType}:${entityId}`;
      const amount = (sig.measures_json as Record<string, number>)?.amount ?? 0;
      return actionableFinding(dedupeKey, groupingKey, dedupeKey, 0.8, {
        headline: `${objectType === "deal" ? "Deal" : "Contact"} missing owner (${ageHours.toFixed(0)}h)`,
        detector_reason: "Owner missing on monitored object type beyond grace period.",
        why_now: `Record is ${Math.round(ageHours)}h old; grace period is ${graceHours}h.`,
        entities: entityId ? [{ entityType: objectType, entityId }] : [],
        signal_references: [{ signalId: sig.id, signalKey: sig.signal_key, signalTime: sig.signal_time }],
        timeline: [{ event: sig.signal_key, timestamp: sig.signal_time, detail: amount ? `$${amount}` : undefined }],
        thresholds_crossed: [{ threshold: "grace_hours", value: ageHours, limit: graceHours }],
      });
    }
    return noFinding("none", "none");
  }
}
