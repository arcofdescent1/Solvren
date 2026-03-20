/**
 * Phase 4 — Detector C1: Duplicate contact cluster (§15.3).
 */
import type { IDetector } from "../base/detector.interface";
import type { DetectorContext } from "../base/detector-context";
import type { DetectionResult } from "../../domain/detection-result";
import { actionableFinding, noFinding } from "../base/detector-result";

const DETECTOR_KEY = "data.duplicate_contact_cluster";
const VERSION = "1.0";

export class DuplicateContactClusterDetector implements IDetector {
  readonly detectorKey = DETECTOR_KEY;
  readonly detectorVersion = VERSION;

  async evaluate(ctx: DetectorContext): Promise<DetectionResult> {
    const dupes = ctx.signals.filter((s) => s.signal_key === "contact_duplicate_candidate");
    if (dupes.length === 0) return noFinding("none", "none");

    const defaults = ctx.detectorDefinition.threshold_defaults_json as { min_cluster_size?: number };
    const minCluster = defaults?.min_cluster_size ?? 2;
    if (dupes.length < minCluster) return noFinding("none", "none");

    const clusterKey = dupes.map((s) => s.primary_canonical_entity_id ?? s.source_ref ?? s.id).sort().join("|");
    const dedupeKey = `duplicate_cluster:${clusterKey}`;
    const groupingKey = `cluster:${clusterKey.slice(0, 64)}`;

    return actionableFinding(dedupeKey, groupingKey, dedupeKey, 0.9, {
      headline: `${dupes.length} duplicate contact candidates in cluster`,
      detector_reason: "Duplicate candidates exceed threshold for same cluster.",
      why_now: `Cluster has ${dupes.length} candidates (min: ${minCluster}).`,
      entities: dupes.slice(0, 5).map((s) => ({
        entityType: "person",
        entityId: s.primary_canonical_entity_id ?? s.id,
      })),
      signal_references: dupes.slice(0, 5).map((s) => ({
        signalId: s.id,
        signalKey: s.signal_key,
        signalTime: s.signal_time,
      })),
      timeline: dupes.slice(0, 5).map((s) => ({
        event: "duplicate_candidate",
        timestamp: s.signal_time,
        detail: s.source_ref ?? undefined,
      })),
      thresholds_crossed: [{ threshold: "min_cluster_size", value: dupes.length, limit: minCluster }],
    });
  }
}
