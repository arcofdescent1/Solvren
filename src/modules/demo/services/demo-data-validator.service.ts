/**
 * Phase 8 — Demo data validator.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type ValidationResult = {
  healthy: boolean;
  errors: string[];
  counts: Record<string, number>;
};

export async function validateDemoData(
  supabase: SupabaseClient,
  orgId: string
): Promise<ValidationResult> {
  const errors: string[] = [];
  const counts: Record<string, number> = {};

  const { count: issueCount, error: icErr } = await supabase
    .from("issues")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .like("issue_key", "DEMO-%");
  if (icErr) errors.push(`Failed to count issues: ${icErr.message}`);
  else counts.issues = issueCount ?? 0;

  const { count: outcomeCount, error: ocErr } = await supabase
    .from("outcomes")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);
  if (ocErr) errors.push(`Failed to count outcomes: ${ocErr.message}`);
  else counts.outcomes = outcomeCount ?? 0;

  const { count: timelineCount, error: tcErr } = await supabase
    .from("revenue_timeline_events")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);
  if (tcErr) errors.push(`Failed to count timeline: ${tcErr.message}`);
  else counts.revenue_timeline_events = timelineCount ?? 0;

  if (counts.issues < 50) errors.push(`Expected at least 50 issues, got ${counts.issues}`);
  if (counts.outcomes < 10) errors.push(`Expected at least 10 outcomes, got ${counts.outcomes}`);
  if (counts.revenue_timeline_events < 5) errors.push(`Expected at least 5 timeline events, got ${counts.revenue_timeline_events}`);

  return {
    healthy: errors.length === 0,
    errors,
    counts,
  };
}
