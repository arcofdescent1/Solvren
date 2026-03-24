/**
 * Phase 5 — Map governance contract → Phase 3 PolicyEvaluationContext.
 */
import type { PolicyEvaluationContext, AutonomyMode } from "@/modules/policy/domain";
import type { GovernanceAutonomyMode, GovernanceEvaluationContext } from "./types/governance-context";

function mapEnvironment(
  e: GovernanceEvaluationContext["environment"]
): PolicyEvaluationContext["environment"] {
  switch (e) {
    case "prod":
      return "production";
    case "staging":
      return "staging";
    case "dev":
    default:
      return "sandbox";
  }
}

function mapRequestedMode(mode?: GovernanceAutonomyMode): AutonomyMode {
  switch (mode) {
    case "MANUAL":
      return "manual_only";
    case "SUGGESTED":
      return "suggest_only";
    case "ASSISTED":
      return "approve_then_execute";
    case "AUTO":
      return "auto_execute_low_risk";
    default:
      return "approve_then_execute";
  }
}

export function governanceContextToPolicyContext(
  ctx: GovernanceEvaluationContext
): PolicyEvaluationContext {
  const md: Record<string, unknown> = {
    governanceResourceType: ctx.target.resourceType,
    transitionKey: ctx.target.transitionKey,
    changeEventId: ctx.change?.changeId ?? ctx.target.resourceId,
    changeDomain: ctx.change?.domain,
    evidenceWaiver: ctx.target.resourceType === "evidence_waiver",
    legalHold: ctx.controls?.legalHold,
    financeHold: ctx.controls?.financeHold,
    hasRequiredEvidence: ctx.controls?.hasRequiredEvidence,
    ...(ctx.extensions ?? {}),
  };

  const playbookFromExt =
    ctx.extensions && typeof ctx.extensions.playbookKey === "string"
      ? ctx.extensions.playbookKey
      : undefined;
  const workflowStepFromExt =
    ctx.extensions && typeof ctx.extensions.workflowStepKey === "string"
      ? ctx.extensions.workflowStepKey
      : undefined;

  return {
    orgId: ctx.orgId,
    environment: mapEnvironment(ctx.environment),
    issueId: ctx.issue?.issueId,
    findingId: undefined,
    actionKey: ctx.target.actionKey,
    playbookKey: playbookFromExt,
    workflowStepKey: workflowStepFromExt ?? ctx.target.transitionKey,
    provider: ctx.target.provider,
    integrationId: ctx.target.integrationKey,
    primaryEntityType: ctx.target.resourceType,
    primaryEntityId: ctx.target.resourceId,
    severity: ctx.issue?.severity as PolicyEvaluationContext["severity"],
    riskLevel: ctx.change?.riskLevel as PolicyEvaluationContext["riskLevel"],
    impactAmount: ctx.issue?.impactAmount ?? null,
    confidenceScore: ctx.issue?.confidence ?? null,
    actorUserId: ctx.actor.userId ?? null,
    actorRoles: ctx.actor.roleKeys,
    requestedMode: mapRequestedMode(ctx.autonomy?.requestedMode),
    metadata: md,
  };
}
