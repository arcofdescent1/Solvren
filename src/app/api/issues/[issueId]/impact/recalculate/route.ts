/**
 * Phase 5 — POST /api/issues/:issueId/impact/recalculate (§18.3).
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getIssueDetail } from "@/modules/issues";
import { assessImpact } from "@/modules/impact/engine/impact-engine.service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { issueId } = await params;
  const { issue } = await getIssueDetail(supabase, issueId);
  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

  if (issue.source_type !== "detector" || !issue.source_ref) {
    return NextResponse.json(
      { error: "Recalculation only supported for detector-sourced issues" },
      { status: 400 }
    );
  }

  const result = await assessImpact(supabase, {
    orgId: issue.org_id,
    issueId,
    findingId: issue.source_ref,
    detectorKey: null,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true, assessmentId: result.assessmentId });
}
