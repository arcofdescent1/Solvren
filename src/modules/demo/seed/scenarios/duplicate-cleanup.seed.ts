/**
 * Phase 8 — Duplicate Data Cleanup scenario.
 * Focus: duplicate cluster → merge → operational savings.
 */
import { buildExecutiveHeroSeed } from "./executive-hero.seed";

export function buildDuplicateCleanupSeed(orgId: string) {
  return buildExecutiveHeroSeed(orgId);
}
