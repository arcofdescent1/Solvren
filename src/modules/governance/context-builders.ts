/**
 * Phase 5 — Build GovernanceEvaluationContext for common journeys (callers stay explicit).
 */
import type { PolicyEvaluationContext } from "@/modules/policy/domain";
import type { GovernanceAutonomyMode, GovernanceEvaluationContext } from "./types/governance-context";

export function policyEnvironmentToGovernance(
  e: PolicyEvaluationContext["environment"]
): GovernanceEvaluationContext["environment"] {
  if (e === "production") return "prod";
  if (e === "staging") return "staging";
  return "dev";
}

function mapLegacyRequestedMode(mode?: string): GovernanceAutonomyMode | undefined {
  switch (mode) {
    case "manual_only":
      return "MANUAL";
    case "suggest_only":
      return "SUGGESTED";
    case "approve_then_execute":
      return "ASSISTED";
    case "auto_execute_low_risk":
    case "auto_execute_policy_bounded":
      return "AUTO";
    default:
      return undefined;
  }
}

/** Integration action execution / API action POST (preExecutionCheck). */
export function buildIntegrationActionGovernanceContext(args: {
  orgId: string;
  environment?: PolicyEvaluationContext["environment"];
  actionKey: string;
  playbookKey?: string;
  issueId?: string;
  impactAmount?: number | null;
  requestedMode?: string;
  actorUserId?: string | null;
  provider?: string;
}): GovernanceEvaluationContext {
  const requested = mapLegacyRequestedMode(args.requestedMode);
  const ext: Record<string, unknown> = {};
  if (args.playbookKey) ext.playbookKey = args.playbookKey;

  return {
    orgId: args.orgId,
    environment: policyEnvironmentToGovernance(args.environment ?? "production"),
    actor: {
      userId: args.actorUserId ?? undefined,
      actorType: args.actorUserId ? "user" : "system",
    },
    target: {
      resourceType: "integration_action",
      actionKey: args.actionKey,
      provider: args.provider,
    },
    issue:
      args.issueId != null || args.impactAmount != null
        ? {
            issueId: args.issueId,
            impactAmount: args.impactAmount ?? undefined,
          }
        : undefined,
    autonomy: requested ? { requestedMode: requested } : undefined,
    extensions: Object.keys(ext).length ? ext : undefined,
  };
}
