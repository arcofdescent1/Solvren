/**
 * Phase 3 — Policy condition evaluation (§9).
 */
import type { PolicyCondition, PolicyConditionGroup } from "../domain";
import type { PolicyEvaluationContext } from "../domain";

const SUPPORTED_FIELDS = new Set([
  "environment",
  "actionKey",
  "playbookKey",
  "issueFamily",
  "detectorKey",
  "provider",
  "integrationId",
  "severity",
  "priorityBand",
  "riskLevel",
  "impactAmount",
  "confidenceScore",
  "requestedMode",
  "actorRoles",
  "primaryEntityType",
]);

function getContextValue(ctx: PolicyEvaluationContext, field: string): unknown {
  const map: Record<string, () => unknown> = {
    environment: () => ctx.environment,
    actionKey: () => ctx.actionKey,
    playbookKey: () => ctx.playbookKey,
    issueFamily: () => ctx.issueFamily,
    detectorKey: () => ctx.detectorKey,
    provider: () => ctx.provider,
    integrationId: () => ctx.integrationId,
    severity: () => ctx.severity,
    priorityBand: () => ctx.priorityBand,
    riskLevel: () => ctx.riskLevel,
    impactAmount: () => ctx.impactAmount,
    confidenceScore: () => ctx.confidenceScore,
    requestedMode: () => ctx.requestedMode,
    actorRoles: () => ctx.actorRoles,
    primaryEntityType: () => ctx.primaryEntityType,
  };
  const fn = map[field];
  return fn ? fn() : undefined;
}

function evaluateCondition(cond: PolicyCondition, ctx: PolicyEvaluationContext): boolean {
  if (!SUPPORTED_FIELDS.has(cond.field)) return false;

  const actual = getContextValue(ctx, cond.field);
  const expected = cond.value;

  switch (cond.operator) {
    case "EQ":
      return String(actual ?? "") === String(expected ?? "");
    case "NEQ":
      return String(actual ?? "") !== String(expected ?? "");
    case "GT":
      return Number(actual ?? 0) > Number(expected ?? 0);
    case "GTE":
      return Number(actual ?? 0) >= Number(expected ?? 0);
    case "LT":
      return Number(actual ?? 0) < Number(expected ?? 0);
    case "LTE":
      return Number(actual ?? 0) <= Number(expected ?? 0);
    case "IN":
      return Array.isArray(expected) && (expected as unknown[]).includes(actual);
    case "NOT_IN":
      return Array.isArray(expected) && !(expected as unknown[]).includes(actual);
    case "EXISTS":
      return actual !== undefined && actual !== null && actual !== "";
    case "NOT_EXISTS":
      return actual === undefined || actual === null || actual === "";
    default:
      return false;
  }
}

export function evaluateConditionGroup(
  group: PolicyConditionGroup,
  ctx: PolicyEvaluationContext
): boolean {
  const results = group.conditions.map((c) =>
    "operator" in c && "conditions" in c
      ? evaluateConditionGroup(c as PolicyConditionGroup, ctx)
      : evaluateCondition(c as PolicyCondition, ctx)
  );
  return group.operator === "AND" ? results.every(Boolean) : results.some(Boolean);
}
