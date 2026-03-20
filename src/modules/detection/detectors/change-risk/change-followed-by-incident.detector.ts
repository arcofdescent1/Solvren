/**
 * Phase 4 — Detector D3: Change followed by incident (§15.4).
 */
import type { IDetector } from "../base/detector.interface";
import type { DetectorContext } from "../base/detector-context";
import type { DetectionResult } from "../../domain/detection-result";
import { actionableFinding, noFinding } from "../base/detector-result";

const DETECTOR_KEY = "change.change_followed_by_incident";
const VERSION = "1.0";

export class ChangeFollowedByIncidentDetector implements IDetector {
  readonly detectorKey = DETECTOR_KEY;
  readonly detectorVersion = VERSION;

  async evaluate(ctx: DetectorContext): Promise<DetectionResult> {
    const deployed = ctx.signals.filter((s) => s.signal_key === "change_deployed");
    const incidentSignals = ctx.signals.filter((s) => s.signal_key === "incident_created" || s.signal_key === "change_incident_linked");
    if (deployed.length === 0) return noFinding("none", "none");

    const window = ctx.detectorDefinition.evaluation_window_json as { incident_window_hours?: number };
    const incidentHours = window.incident_window_hours ?? 2;

    for (const dep of deployed) {
      const changeId = (dep.references_json as Record<string, string>)?.change_id ?? dep.source_ref ?? dep.id;
      const deployTime = new Date(dep.signal_time).getTime();
      const cutoff = deployTime + incidentHours * 60 * 60 * 1000;

      const relatedIncidents = incidentSignals.filter((s) => {
        const t = new Date(s.signal_time).getTime();
        return t >= deployTime && t <= cutoff;
      });
      if (relatedIncidents.length === 0) continue;

      const dedupeKey = `change_incident:${changeId}`;
      const groupingKey = `change:${changeId}`;
      return actionableFinding(dedupeKey, groupingKey, dedupeKey, 0.9, {
        headline: "Change followed by incident within window",
        detector_reason: "Related incident occurred within configured window after deployment.",
        why_now: "Correlation suggests change may have caused incident.",
        entities: dep.primary_canonical_entity_id ? [{ entityType: "change", entityId: dep.primary_canonical_entity_id }] : [],
        signal_references: [
          { signalId: dep.id, signalKey: dep.signal_key, signalTime: dep.signal_time },
          ...relatedIncidents.slice(0, 2).map((s) => ({ signalId: s.id, signalKey: s.signal_key, signalTime: s.signal_time })),
        ],
        timeline: [
          { event: "change_deployed", timestamp: dep.signal_time },
          { event: "incident", timestamp: relatedIncidents[0]!.signal_time },
        ],
        thresholds_crossed: [{ threshold: "incident_window_hours", value: incidentHours }],
      });
    }
    return noFinding("none", "none");
  }
}
