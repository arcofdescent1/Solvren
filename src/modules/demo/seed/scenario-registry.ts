/**
 * Phase 8 — Scenario registry.
 */
import { buildFailedPaymentRecoverySeed } from "./scenarios/failed-payment-recovery.seed";
import { buildQualifiedLeadRescueSeed } from "./scenarios/qualified-lead-rescue.seed";
import { buildDuplicateCleanupSeed } from "./scenarios/duplicate-cleanup.seed";
import { buildChangeRiskContainedSeed } from "./scenarios/change-risk-contained.seed";
import { buildExecutiveHeroSeed } from "./scenarios/executive-hero.seed";

export type ScenarioBuilder = (orgId: string) => {
  scenarioKey: string;
  seedVersion: string;
  issues: unknown[];
  actions: unknown[];
  outcomes: unknown[];
  timeline: unknown[];
  manifest: { tablesSeeded: string[]; countsExpected: Record<string, number>; scenarioNarrativeObjects?: string[] };
};

const REGISTRY: Record<string, ScenarioBuilder> = {
  failed_payment_recovery: buildFailedPaymentRecoverySeed as ScenarioBuilder,
  qualified_lead_rescue: buildQualifiedLeadRescueSeed as ScenarioBuilder,
  duplicate_cleanup: buildDuplicateCleanupSeed as ScenarioBuilder,
  change_risk_contained: buildChangeRiskContainedSeed as ScenarioBuilder,
  executive_hero: buildExecutiveHeroSeed as ScenarioBuilder,
};

export function getScenarioBuilder(scenarioKey: string): ScenarioBuilder | null {
  return REGISTRY[scenarioKey] ?? null;
}

export function listScenarioKeys(): string[] {
  return Object.keys(REGISTRY);
}
