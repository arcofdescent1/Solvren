/**
 * Phase 4 — Scheduled detector runner job (§18).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { runScheduledDetectorsForOrg } from "../engine/detector-engine.service";

export async function runScheduledDetectors(supabase: SupabaseClient): Promise<{ runs: number; errors: number }> {
  const { data: orgs } = await supabase.from("organizations").select("id");
  let totalRuns = 0;
  let totalErrors = 0;

  for (const o of orgs ?? []) {
    const orgId = (o as { id: string }).id;
    const { runs, errors } = await runScheduledDetectorsForOrg(supabase, orgId, 168);
    totalRuns += runs;
    totalErrors += errors;
  }

  return { runs: totalRuns, errors: totalErrors };
}
