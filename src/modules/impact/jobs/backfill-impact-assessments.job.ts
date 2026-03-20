/**
 * Phase 5 — Backfill impact assessments for issues without summaries (§15).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { assessImpact } from "../engine/impact-engine.service";

export async function backfillImpactAssessments(
  supabase: SupabaseClient,
  orgId: string,
  limit = 50
): Promise<{ processed: number; succeeded: number; errors: number }> {
  const { data: issues } = await supabase
    .from("issues")
    .select("id, org_id, source_type, source_ref")
    .eq("org_id", orgId)
    .in("status", ["open", "triaged", "assigned", "in_progress"])
    .limit(limit * 2);

  const { data: existingSummaries } = await supabase
    .from("issue_impact_summaries")
    .select("issue_id")
    .eq("org_id", orgId);
  const hasSummary = new Set((existingSummaries ?? []).map((s: { issue_id: string }) => s.issue_id));

  const toProcess = (issues ?? []).filter((i) => !hasSummary.has((i as { id: string }).id));
  let succeeded = 0;
  let errors = 0;

  for (const row of toProcess.slice(0, limit)) {
    const i = row as { id: string; org_id: string; source_type: string; source_ref: string };
    if (i.source_type !== "detector" || !i.source_ref) {
      continue;
    }
    const result = await assessImpact(supabase, {
      orgId: i.org_id,
      issueId: i.id,
      findingId: i.source_ref,
      detectorKey: null,
    });
    if (result.ok) succeeded++;
    else errors++;
  }

  return { processed: toProcess.length, succeeded, errors };
}
