/**
 * Phase 8 — Failed Payment Recovery scenario.
 * Focus: payment failure → retry → recovery → ROI.
 */
import { buildExecutiveHeroSeed } from "./executive-hero.seed";

export function buildFailedPaymentRecoverySeed(orgId: string) {
  return buildExecutiveHeroSeed(orgId);
}
