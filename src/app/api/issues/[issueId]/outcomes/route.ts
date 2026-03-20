/**
 * Phase 7 — GET /api/issues/:issueId/outcomes.
 * List outcomes and summary for an issue.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getIssueDetail } from "@/modules/issues";
import { listOutcomesForIssue } from "@/modules/outcomes";
import { getIssueOutcomeSummary } from "@/modules/outcomes/persistence/issue-outcome-summary.repository";

export async function GET(
  _req: Request,
  context: { params: Promise<{ issueId: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { issueId } = await context.params;
  const { issue } = await getIssueDetail(supabase, issueId);
  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

  const [{ data: outcomes }, { data: summary }] = await Promise.all([
    listOutcomesForIssue(supabase, issueId),
    getIssueOutcomeSummary(supabase, issueId),
  ]);

  return NextResponse.json({
    outcomes: outcomes ?? [],
    summary: summary ?? null,
  });
}
