/**
 * Phase 5 — Simulate unified governance for the signed-in org (no mutation by default).
 */
import { NextResponse } from "next/server";
import { authzErrorResponse, requireOrgPermission, resolveDefaultOrgForUser } from "@/lib/server/authz";
import { evaluateGovernance } from "@/modules/governance";
import type { GovernanceEvaluationContext } from "@/modules/governance";

async function orgPolicyContext() {
  const def = await resolveDefaultOrgForUser();
  return requireOrgPermission(def.orgId, "policy.manage");
}

function isGovernanceEnvironment(
  v: unknown
): v is GovernanceEvaluationContext["environment"] {
  return v === "dev" || v === "staging" || v === "prod";
}

export async function POST(req: Request) {
  try {
    const ctx = await orgPolicyContext();
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const b = body as Record<string, unknown>;
    const simulationTier = b.simulationTier === "exploratory" ? "exploratory" : "production_grade";
    if (simulationTier === "exploratory") {
      return NextResponse.json({
        ok: true,
        fidelity: "exploratory",
        simulationTier: "exploratory",
        warning:
          "Heuristic preview only — does not call evaluateGovernance. Do not use for Phase 6 recommendation-grade calibration, rule suggestions, or production decisions.",
        decision: null,
        policyDecision: null,
      });
    }

    if (!isGovernanceEnvironment(b.environment)) {
      return NextResponse.json(
        { error: "environment must be dev, staging, or prod" },
        { status: 400 }
      );
    }
    if (!b.actor || typeof b.actor !== "object" || !b.target || typeof b.target !== "object") {
      return NextResponse.json(
        { error: "actor and target objects are required" },
        { status: 400 }
      );
    }

    const evalCtx: GovernanceEvaluationContext = {
      orgId: ctx.orgId,
      environment: b.environment,
      actor: b.actor as GovernanceEvaluationContext["actor"],
      target: b.target as GovernanceEvaluationContext["target"],
      issue: b.issue as GovernanceEvaluationContext["issue"],
      change: b.change as GovernanceEvaluationContext["change"],
      controls: b.controls as GovernanceEvaluationContext["controls"],
      autonomy: b.autonomy as GovernanceEvaluationContext["autonomy"],
      extensions:
        b.extensions && typeof b.extensions === "object"
          ? (b.extensions as Record<string, unknown>)
          : undefined,
    };

    const persistDecisionLog = b.persistDecisionLog === true;
    const { data, policyDecision, error } = await evaluateGovernance(ctx.supabase, evalCtx, {
      persistDecisionLog,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      fidelity: "production_grade",
      simulationTier: "production_grade",
      decision: data,
      policyDecision,
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
