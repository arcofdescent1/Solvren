/**
 * Phase 3 — Signal quality scoring (§11).
 */
import type { MapperResult } from "../domain/types";

export function computeQualityScore(result: MapperResult): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 80;

  if (result.entityCandidates.length > 0) {
    const maxConf = Math.max(...result.entityCandidates.map((e) => e.confidence));
    if (maxConf >= 0.95) score += 15;
    else if (maxConf >= 0.8) score += 10;
    else if (maxConf >= 0.5) score += 5;
    else flags.push("low_entity_confidence");
  } else {
    flags.push("no_entity_candidates");
    score -= 10;
  }

  const cert = (result.qualityInputs?.mapperCertainty as number) ?? 1;
  if (cert >= 0.95) score += 5;
  else if (cert < 0.7) {
    flags.push("low_mapper_certainty");
    score -= 10;
  }

  if (!result.signalTime) {
    flags.push("missing_signal_time");
    score -= 15;
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    flags,
  };
}
