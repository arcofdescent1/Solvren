/**
 * Phase 2 — Resolution rules service (§8.7). Read/apply org-specific thresholds and config.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_CONFIDENCE_THRESHOLDS } from "../constants";
import { listResolutionRules, type EntityResolutionRuleRow } from "../repositories/resolutionRulesRepository";

export type EffectiveThresholds = {
  autoLink: number;
  reviewMin: number;
};

/** Effective thresholds for an org + entity type. Rules override defaults. */
export async function getEffectiveThresholds(
  supabase: SupabaseClient,
  orgId: string,
  entityType: string
): Promise<EffectiveThresholds> {
  const { data: rules } = await listResolutionRules(supabase, {
    orgId,
    entityType,
    enabled: true,
  });
  const thresholdsRule = rules.find((r) => r.rule_key === "thresholds");
  const config = (thresholdsRule?.config_json ?? {}) as Record<string, unknown>;
  return {
    autoLink: typeof config.autoLink === "number" ? config.autoLink : DEFAULT_CONFIDENCE_THRESHOLDS.autoLink,
    reviewMin: typeof config.reviewMin === "number" ? config.reviewMin : DEFAULT_CONFIDENCE_THRESHOLDS.reviewMin,
  };
}

/** All rules for an org (optionally by entity type). Used by admin/API. */
export async function getResolutionRules(
  supabase: SupabaseClient,
  orgId: string,
  entityType?: string
): Promise<EntityResolutionRuleRow[]> {
  const { data } = await listResolutionRules(supabase, { orgId, entityType, enabled: undefined });
  return data;
}

