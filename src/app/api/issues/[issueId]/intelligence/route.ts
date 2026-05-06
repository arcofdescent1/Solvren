import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authzErrorResponse, requireOrgPermission } from "@/lib/server/authz";
import { deriveConfidenceBand } from "@/lib/issues/issueIntelligenceScoring";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ issueId: string }> }
) {
  try {
    const { issueId } = await ctx.params;
    const supabase = await createServerSupabaseClient();

    const { data: issue, error: le } = await supabase
      .from("issues")
      .select(
        "id, org_id, priority_score, priority_band, confidence_score, noise_score, recurrence_count, priority_reason, related_issue_group_id, suppressed_until, suppression_reason"
      )
      .eq("id", issueId)
      .maybeSingle();

    if (le || !issue) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await requireOrgPermission((issue as { org_id: string }).org_id, "issues.view");

    const { data: hist } = await supabase
      .from("issue_score_history")
      .select("id, priority_score, priority_band, confidence_score, noise_score, score_reason, created_at")
      .eq("issue_id", issueId)
      .order("created_at", { ascending: false })
      .limit(50);

    let relatedGroup: Record<string, unknown> | null = null;
    const gid = (issue as { related_issue_group_id?: string | null }).related_issue_group_id;
    if (gid) {
      const { data: g } = await supabase
        .from("issue_groups")
        .select("*")
        .eq("id", gid)
        .maybeSingle();
      if (g) relatedGroup = g as Record<string, unknown>;
    }

    const cs = Number((issue as { confidence_score?: number }).confidence_score ?? 50);

    return NextResponse.json({
      priorityScore: (issue as { priority_score?: number }).priority_score ?? 0,
      priorityBand: (issue as { priority_band?: string }).priority_band ?? "low",
      confidenceScore: Number.isFinite(cs) ? cs : 50,
      confidenceBand: deriveConfidenceBand(Number.isFinite(cs) ? cs : 50),
      noiseScore: (issue as { noise_score?: number }).noise_score ?? 0,
      recurrenceCount: (issue as { recurrence_count?: number }).recurrence_count ?? 0,
      priorityReason: (issue as { priority_reason?: unknown }).priority_reason ?? {},
      scoreHistory: hist ?? [],
      relatedGroup,
      suppressedUntil: (issue as { suppressed_until?: string | null }).suppressed_until ?? null,
      suppressionReason: (issue as { suppression_reason?: string | null }).suppression_reason ?? null,
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
