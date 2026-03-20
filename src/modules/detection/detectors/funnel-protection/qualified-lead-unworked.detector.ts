/**
 * Phase 4 — Detector B1: Qualified lead unworked (§15.2).
 */
import type { IDetector } from "../base/detector.interface";
import type { DetectorContext } from "../base/detector-context";
import type { DetectionResult } from "../../domain/detection-result";
import { actionableFinding, noFinding } from "../base/detector-result";

const DETECTOR_KEY = "funnel.qualified_lead_unworked";
const VERSION = "1.0";

const QUALIFIED_STATUSES = ["qualified", "qualified_lead", "converted", "sales_qualified"];

export class QualifiedLeadUnworkedDetector implements IDetector {
  readonly detectorKey = DETECTOR_KEY;
  readonly detectorVersion = VERSION;

  async evaluate(ctx: DetectorContext): Promise<DetectionResult> {
    const leadSignals = ctx.signals.filter(
      (s) => s.signal_key === "lead_status_changed" || s.signal_key === "lead_created"
    );
    if (leadSignals.length === 0) return noFinding("none", "none");

    const window = ctx.detectorDefinition.evaluation_window_json as { sla_hours?: number };
    const slaHours = window.sla_hours ?? 24;

    for (const sig of leadSignals) {
      const dims = (sig.dimensions_json ?? {}) as Record<string, string>;
      const status = (dims.status ?? dims.new_status ?? "").toLowerCase();
      const isQualified = QUALIFIED_STATUSES.some((q) => status.includes(q.toLowerCase()));
      if (!isQualified) continue;

      const entityId = sig.primary_canonical_entity_id ?? sig.source_ref ?? sig.id;
      const qualifiedTime = new Date(sig.signal_time).getTime();
      const cutoff = Date.now() - slaHours * 60 * 60 * 1000;
      if (qualifiedTime > cutoff) continue;

      const hasFollowUp = ctx.signals.some((s) => {
        if (s.signal_key !== "meeting_booked" && s.signal_key !== "task_created") return false;
        const followUpTime = new Date(s.signal_time).getTime();
        return followUpTime > qualifiedTime && (s.primary_canonical_entity_id === entityId || s.source_ref === entityId);
      });
      if (hasFollowUp) continue;

      const dedupeKey = `qualified_lead_unworked:${entityId}:${Math.floor(qualifiedTime / 86400000)}`;
      const groupingKey = `lead:${entityId}`;
      const hoursSince = Math.round((Date.now() - qualifiedTime) / 3600000);
      return actionableFinding(dedupeKey, groupingKey, dedupeKey, 0.8, {
        headline: `Qualified lead with no follow-up for ${hoursSince}h`,
        detector_reason: "No meeting or task created within SLA after qualification.",
        why_now: `Lead qualified ${hoursSince}h ago; SLA is ${slaHours}h.`,
        entities: entityId ? [{ entityType: "person", entityId }] : [],
        signal_references: [{ signalId: sig.id, signalKey: sig.signal_key, signalTime: sig.signal_time }],
        timeline: [{ event: "qualified", timestamp: sig.signal_time, detail: `Status: ${status}` }],
        thresholds_crossed: [{ threshold: "sla_hours", value: hoursSince, limit: slaHours }],
      });
    }
    return noFinding("none", "none");
  }
}
