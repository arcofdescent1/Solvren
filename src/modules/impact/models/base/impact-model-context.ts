/**
 * Phase 5 — Impact model evaluation context (§9).
 */
import type { ImpactModelRow } from "../../domain/impact-model";

export type ImpactModelContext = {
  orgId: string;
  issueId: string | null;
  findingId: string | null;
  detectorKey: string | null;
  evidenceBundle: Record<string, unknown>;
  signals: Array<{
    id: string;
    signal_key: string;
    signal_time: string;
    dimensions_json: Record<string, unknown>;
    measures_json: Record<string, unknown>;
    references_json: Record<string, unknown>;
  }>;
  assumptions: Record<string, number | string | boolean>;
  modelDefinition: ImpactModelRow;
};
