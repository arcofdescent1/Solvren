/**
 * Phase 0 — Issue counts for executive summary / reporting.
 * Simple counts on issues for the org (open vs resolved).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type IssueExecutiveSummary = {
  openCount: number;
  resolvedCount: number;
  totalCount: number;
};

const OPEN_STATUSES = ["open", "triaged", "assigned", "in_progress"];
const RESOLVED_STATUSES = ["resolved", "verified", "dismissed"];

export async function getIssueExecutiveSummary(
  supabase: SupabaseClient,
  orgId: string
): Promise<IssueExecutiveSummary> {
  const { count: totalCount, error: totalErr } = await supabase
    .from("issues")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);

  if (totalErr) {
    return { openCount: 0, resolvedCount: 0, totalCount: 0 };
  }

  const { count: openCount, error: openErr } = await supabase
    .from("issues")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("status", OPEN_STATUSES);

  if (openErr) {
    return { openCount: 0, resolvedCount: 0, totalCount: totalCount ?? 0 };
  }

  const { count: resolvedCount, error: resolvedErr } = await supabase
    .from("issues")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("status", RESOLVED_STATUSES);

  if (resolvedErr) {
    return { openCount: openCount ?? 0, resolvedCount: 0, totalCount: totalCount ?? 0 };
  }

  return {
    openCount: openCount ?? 0,
    resolvedCount: resolvedCount ?? 0,
    totalCount: totalCount ?? 0,
  };
}
