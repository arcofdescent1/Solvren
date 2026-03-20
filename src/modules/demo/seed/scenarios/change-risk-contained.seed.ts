/**
 * Phase 8 — Change Risk Blocked scenario.
 * Focus: risky change → policy block → incident avoided.
 */
import { buildExecutiveHeroSeed } from "./executive-hero.seed";

export function buildChangeRiskContainedSeed(orgId: string) {
  return buildExecutiveHeroSeed(orgId);
}
