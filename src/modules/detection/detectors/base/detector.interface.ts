/**
 * Phase 4 — Detector interface (§7.2).
 */
import type { DetectionResult } from "../../domain/detection-result";
import type { DetectorContext } from "./detector-context";

export interface IDetector {
  readonly detectorKey: string;
  readonly detectorVersion: string;

  evaluate(ctx: DetectorContext): Promise<DetectionResult>;
}
