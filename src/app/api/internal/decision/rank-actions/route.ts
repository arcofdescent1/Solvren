/**
 * Phase 5 — POST /api/internal/decision/rank-actions (§22.1).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { rankActions } from "@/modules/decision/services/decision-engine.service";
import type { DecisionContext } from "@/modules/decision/domain/decision-context";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = env.cronSecret;
  const isInternal = cronSecret && authHeader === `Bearer ${cronSecret}`;

  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();

  if (!isInternal && !userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ctx: DecisionContext = {
    orgId: String(body.orgId ?? ""),
    environment: (body.environment ?? "production") as DecisionContext["environment"],
    issueId: body.issueId as string | undefined,
    findingId: body.findingId as string | undefined,
    workflowRunId: body.workflowRunId as string | undefined,
    workflowStepKey: body.workflowStepKey as string | undefined,
    issueFamily: body.issueFamily as string | undefined,
    detectorKey: body.detectorKey as string | undefined,
    playbookKey: body.playbookKey as string | undefined,
    severity: body.severity as DecisionContext["severity"],
    priorityBand: body.priorityBand as DecisionContext["priorityBand"],
    impactAmount: body.impactAmount as number | null | undefined,
    impactScore: body.impactScore as number | null | undefined,
    confidenceScore: body.confidenceScore as number | null | undefined,
    primaryEntityType: body.primaryEntityType as string | null | undefined,
    primaryEntityId: body.primaryEntityId as string | null | undefined,
    evidenceSummary: body.evidenceSummary as Record<string, unknown> | undefined,
    signalSummary: body.signalSummary as Record<string, unknown> | undefined,
    actionHistorySummary: body.actionHistorySummary as Record<string, unknown> | undefined,
    requestedMode: (body.requestedMode ?? "approve_then_execute") as DecisionContext["requestedMode"],
    candidateActionKeys: Array.isArray(body.candidateActionKeys) ? body.candidateActionKeys as string[] : [],
    metadata: body.metadata as Record<string, unknown> | undefined,
  };

  const { data, error } = await rankActions(supabase, ctx);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
