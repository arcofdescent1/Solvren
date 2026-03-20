/**
 * Phase 6 — Cohort eligibility service (§16.2).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getOrgDimensions,
  dimensionMatches,
  type OrgBenchmarkDimensionsRow,
} from "../repositories/org-benchmark-dimensions.repository";

export async function isOrgEligibleForCohort(
  supabase: SupabaseClient,
  orgId: string,
  cohortDefinitionJson: Record<string, unknown>
): Promise<boolean> {
  const dims = (cohortDefinitionJson.dimensions ?? {}) as Record<string, string | undefined>;
  const { data } = await getOrgDimensions(supabase, orgId);
  return dimensionMatches(data, dims);
}

export async function filterEligibleOrgIds(
  supabase: SupabaseClient,
  orgIds: string[],
  cohortDefinitionJson: Record<string, unknown>
): Promise<string[]> {
  const dims = (cohortDefinitionJson.dimensions ?? {}) as Record<string, string | undefined>;
  const eligible: string[] = [];
  for (const orgId of orgIds) {
    const { data } = await getOrgDimensions(supabase, orgId);
    if (dimensionMatches(data, dims)) eligible.push(orgId);
  }
  return eligible;
}
