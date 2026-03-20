/**
 * Phase 7 — POST /api/outcomes/record.
 * Record outcome (manual attestation, webhook callback, etc.).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getIssueDetail } from "@/modules/issues";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    issueId: string;
    actionId?: string | null;
    outcomeType: "recovered_revenue" | "avoided_loss" | "operational_savings";
    amount: number;
    verificationType?: "direct" | "inferred" | "probabilistic";
    confidenceScore?: number;
    evidence?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { issueId, actionId, outcomeType, amount, verificationType = "direct", confidenceScore = 1.0, evidence } = body;
  if (!issueId || outcomeType == null || typeof amount !== "number" || amount < 0) {
    return NextResponse.json({ error: "issueId, outcomeType, amount (>=0) required" }, { status: 400 });
  }

  const { issue } = await getIssueDetail(supabase, issueId);
  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

  const { insertOutcome } = await import("@/modules/outcomes/persistence/outcomes.repository");
  const { recomputeIssueOutcomeSummary } = await import("@/modules/outcomes/persistence/issue-outcome-summary.repository");

  const { data: outcome, error } = await insertOutcome(supabase, {
    org_id: issue.org_id,
    issue_id: issueId,
    action_id: actionId ?? null,
    outcome_type: outcomeType,
    amount,
    currency: "USD",
    verification_type: verificationType,
    confidence_score: confidenceScore,
    evidence_json: evidence ?? {},
  });

  if (error || !outcome) {
    return NextResponse.json({ error: (error as Error)?.message ?? "Failed to insert" }, { status: 500 });
  }

  await recomputeIssueOutcomeSummary(supabase, issueId, issue.org_id);

  return NextResponse.json({ ok: true, outcomeId: outcome.id });
}
