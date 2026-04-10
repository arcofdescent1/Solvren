/**
 * Phase 6 — Org benchmark dimensions repository (§14.4).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type OrgBenchmarkDimensionsRow = {
  org_id: string;
  company_size_band: string | null;
  arr_band: string | null;
  business_model: string | null;
  sales_motion: string | null;
  industry_family: string | null;
  integration_footprint_tier: string | null;
  operational_maturity_tier: string | null;
  updated_at: string;
};

const COHORT_TO_COL: Record<string, string> = {
  companySizeBand: "company_size_band",
  arrBand: "arr_band",
  businessModel: "business_model",
  salesMotion: "sales_motion",
  industryFamily: "industry_family",
  integrationFootprintTier: "integration_footprint_tier",
  operationalMaturityTier: "operational_maturity_tier",
};

export function dimensionMatches(
  orgDims: OrgBenchmarkDimensionsRow | null,
  cohortDims: Record<string, string | undefined>
): boolean {
  if (!orgDims) return false;
  for (const [cohortKey, cohortVal] of Object.entries(cohortDims)) {
    if (cohortVal == null || cohortVal === "") continue;
    const col = COHORT_TO_COL[cohortKey] ?? cohortKey;
    const orgVal = orgDims[col as keyof OrgBenchmarkDimensionsRow];
    if (orgVal !== cohortVal) return false;
  }
  return true;
}

export async function getOrgDimensions(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ data: OrgBenchmarkDimensionsRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("org_benchmark_dimensions")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();
  return { data: data as OrgBenchmarkDimensionsRow | null, error: error as Error | null };
}

export async function listOrgsWithDimensions(
  supabase: SupabaseClient,
  filters?: Partial<OrgBenchmarkDimensionsRow>
): Promise<{ data: OrgBenchmarkDimensionsRow[]; error: Error | null }> {
  let q = supabase.from("org_benchmark_dimensions").select("*");
  if (filters) {
    for (const [k, v] of Object.entries(filters)) {
      if (v != null) q = q.eq(k, v);
    }
  }
  const { data, error } = await q;
  return { data: (data ?? []) as OrgBenchmarkDimensionsRow[], error: error as Error | null };
}

export async function upsertOrgDimensions(
  supabase: SupabaseClient,
  orgId: string,
  dimensions: Partial<Omit<OrgBenchmarkDimensionsRow, "org_id" | "updated_at">>
): Promise<{ error: Error | null }> {
  const row = {
    org_id: orgId,
    ...dimensions,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("org_benchmark_dimensions")
    .upsert(row as Record<string, unknown>, { onConflict: "org_id" });
  return { error: error as Error | null };
}
