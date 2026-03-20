/**
 * Phase 4 — Detector evaluation context (§7.2).
 */
import type { NormalizedSignalRow } from "@/modules/signals/domain/types";
import type { DetectorConfigRow } from "../../domain/detector-config";
import type { DetectorDefinitionRow } from "../../domain/detector-definition";

export type DetectorContext = {
  orgId: string;
  detectorDefinition: DetectorDefinitionRow;
  detectorConfig: DetectorConfigRow | null;
  signals: NormalizedSignalRow[];
  triggerSignalId: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  priorState?: Record<string, unknown>;
};
