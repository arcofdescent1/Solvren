/**
 * Phase 5 — Impact model interface (§9).
 */
import type { ImpactModelContext } from "./impact-model-context";
import type { ImpactModelResult } from "./impact-model-result";

export interface IImpactModel {
  readonly modelKey: string;
  readonly modelVersion: string;

  evaluate(ctx: ImpactModelContext): Promise<ImpactModelResult>;
}
