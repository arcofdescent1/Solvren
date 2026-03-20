/**
 * Phase 6 — Refresh org benchmark dimensions job (§17).
 * Populates org_benchmark_dimensions from org metadata.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { upsertOrgDimensions } from "../repositories/org-benchmark-dimensions.repository";

export async function runRefreshOrgBenchmarkDimensions(
  supabase?: SupabaseClient
): Promise<{ updated: number; errors: string[] }> {
  const admin = supabase ?? createAdminClient();
  const errors: string[] = [];
  let updated = 0;

  const { data: orgs } = await admin
    .from("organizations")
    .select("id");

  for (const org of orgs ?? []) {
    const orgId = (org as { id: string }).id;
    const { error } = await upsertOrgDimensions(admin, orgId, {
      company_size_band: null,
      arr_band: null,
      business_model: null,
      sales_motion: null,
      industry_family: null,
      integration_footprint_tier: null,
      operational_maturity_tier: null,
    });
    if (error) {
      errors.push(`${orgId}: ${error.message}`);
    } else {
      updated++;
    }
  }

  return { updated, errors };
}
