/**
 * Phase 3 — POST /api/internal/policy/evaluate.
 * Internal-only: for action/playbook services to call before execution.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { evaluate } from "@/modules/policy/services/policy-engine.service";
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

  const ctx = {
    orgId: body.orgId as string,
    environment: (body.environment ?? "production") as "production" | "staging" | "sandbox" | "demo" | "internal",
    issueId: body.issueId as string | undefined,
    findingId: body.findingId as string | undefined,
    issueFamily: body.issueFamily as string | undefined,
    detectorKey: body.detectorKey as string | undefined,
    playbookKey: body.playbookKey as string | undefined,
    workflowStepKey: body.workflowStepKey as string | undefined,
    actionKey: body.actionKey as string | undefined,
    provider: body.provider as string | undefined,
    integrationId: body.integrationId as string | undefined,
    primaryEntityType: body.primaryEntityType as string | undefined,
    primaryEntityId: body.primaryEntityId as string | undefined,
    severity: body.severity as "low" | "medium" | "high" | "critical" | undefined,
    priorityBand: body.priorityBand as "P1" | "P2" | "P3" | "P4" | null | undefined,
    riskLevel: body.riskLevel as "low" | "medium" | "high" | "critical" | undefined,
    impactAmount: body.impactAmount as number | null | undefined,
    currencyCode: body.currencyCode as string | null | undefined,
    confidenceScore: body.confidenceScore as number | null | undefined,
    actorUserId: body.actorUserId as string | null | undefined,
    actorRoles: body.actorRoles as string[] | undefined,
    requestedMode: body.requestedMode as
      | "manual_only"
      | "suggest_only"
      | "approve_then_execute"
      | "auto_execute_low_risk"
      | "auto_execute_policy_bounded"
      | "full_trusted_autonomy"
      | undefined,
    metadata: body.metadata as Record<string, unknown> | undefined,
  };

  const { data, error } = await evaluate(supabase, ctx);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
