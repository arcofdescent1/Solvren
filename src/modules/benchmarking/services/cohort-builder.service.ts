/**
 * Phase 6 — Cohort builder service (§16.1).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBenchmarkCohort } from "../repositories/benchmark-cohorts.repository";
import { listOrgsWithDimensions } from "../repositories/org-benchmark-dimensions.repository";
import { filterEligibleOrgIds } from "./cohort-eligibility.service";

export type CohortBuildResult = {
  cohortKey: string;
  orgIds: string[];
  orgCount: number;
};

export async function buildCohort(
  supabase: SupabaseClient,
  cohortKey: string,
  _metricKey: string,
  _snapshotTime: string
): Promise<{ data: CohortBuildResult | null; error: Error | null }> {
  const { data: cohort, error: cohortErr } = await getBenchmarkCohort(
    supabase,
    cohortKey
  );
  if (cohortErr || !cohort) {
    return { data: null, error: cohortErr ?? new Error("Cohort not found") };
  }

  const def = cohort.cohort_definition_json as Record<string, unknown>;
  const dims = (def.dimensions ?? {}) as Record<string, string | undefined>;

  const DIM_MAP: Record<string, string> = {
    companySizeBand: "company_size_band",
    arrBand: "arr_band",
    businessModel: "business_model",
    salesMotion: "sales_motion",
    industryFamily: "industry_family",
    integrationFootprintTier: "integration_footprint_tier",
    operationalMaturityTier: "operational_maturity_tier",
  };
  const filters: Record<string, string> = {};
  for (const [k, v] of Object.entries(dims)) {
    if (v == null || v === "") continue;
    const col = DIM_MAP[k] ?? k;
    filters[col] = v;
  }

  const { data: orgDims, error: dimsErr } = await listOrgsWithDimensions(
    supabase,
    Object.keys(filters).length > 0 ? filters : undefined
  );
  if (dimsErr) return { data: null, error: dimsErr };

  const candidateIds = orgDims.map((o) => o.org_id);
  const orgIds =
    Object.keys(filters).length > 0
      ? await filterEligibleOrgIds(supabase, candidateIds, def)
      : candidateIds;

  const minOrg = cohort.minimum_org_count;
  const filtered =
    orgIds.length >= minOrg ? orgIds : [];

  return {
    data: {
      cohortKey,
      orgIds: filtered,
      orgCount: filtered.length,
    },
    error: null,
  };
}
