/**
 * Phase 5 — Recalculate impact for a single issue (§15).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { assessImpact } from "../engine/impact-engine.service";

export async function recalculateImpactForIssue(
  supabase: SupabaseClient,
  issueId: string,
  orgId: string,
  findingId?: string | null,
  detectorKey?: string | null
): Promise<{ ok: boolean; assessmentId?: string; error?: string }> {
  const result = await assessImpact(supabase, {
    orgId,
    issueId,
    findingId: findingId ?? null,
    detectorKey: detectorKey ?? null,
  });
  if (result.ok) return { ok: true, assessmentId: result.assessmentId };
  return { ok: false, error: result.error };
}
