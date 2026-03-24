/**
 * Phase 6 — Trigger learning jobs (draft outputs only; kill-switch aware).
 */
import { NextResponse } from "next/server";
import { authzErrorResponse, requireOrgPermission, resolveDefaultOrgForUser } from "@/lib/server/authz";
import { runLearningOrchestrator, type OrchestratorRunKind } from "@/modules/learning/learning-orchestrator.service";

function isRunKind(v: unknown): v is OrchestratorRunKind {
  return (
    v === "calibration" ||
    v === "rule_suggestions" ||
    v === "autonomy" ||
    v === "implicit_labels" ||
    v === "all"
  );
}

export async function POST(req: Request) {
  try {
    const def = await resolveDefaultOrgForUser();
    const ctx = await requireOrgPermission(def.orgId, "policy.manage");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    const kind = b.kind;
    if (!isRunKind(kind)) {
      return NextResponse.json(
        { error: "kind must be calibration | rule_suggestions | autonomy | implicit_labels | all" },
        { status: 400 }
      );
    }
    const targetPolicyId =
      typeof b.targetPolicyId === "string" && b.targetPolicyId.trim() ? b.targetPolicyId.trim() : null;

    const result = await runLearningOrchestrator(ctx.supabase, ctx.orgId, ctx.user.id, kind, {
      targetPolicyId,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error ?? "Orchestrator failed", details: result.details }, { status: 409 });
    }

    return NextResponse.json({ ok: true, details: result.details });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
