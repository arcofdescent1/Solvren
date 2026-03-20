/**
 * Phase 8 — Qualified Lead Rescue scenario.
 * Focus: lead SLA breach → assignment → meeting → avoided loss.
 */
import { buildExecutiveHeroSeed } from "./executive-hero.seed";

export function buildQualifiedLeadRescueSeed(orgId: string) {
  return buildExecutiveHeroSeed(orgId);
}
