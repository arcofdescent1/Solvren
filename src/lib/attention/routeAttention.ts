import { getPrimaryAttentionDriver, type AttentionDriverInput } from "./getPrimaryAttentionDriver";
import { getInterruptionReason } from "./getInterruptionReason";
import { delegateApproval } from "./delegateApproval";
import type {
  AttentionChannel,
  AttentionContext,
  AttentionEventType,
  AttentionRouteType,
  AttentionRoutingResult,
  DeliveryTemplate,
  RoutingPersona,
} from "./types";
import { deployUrgencyBucket } from "./materialSnapshot";

function personaRevenueThreshold(persona: RoutingPersona, ctx: AttentionContext): number {
  if (persona === "EXECUTIVE") return ctx.settings.executiveRevenueThresholdUsd;
  if (persona === "SENIOR_TECH_LEADER") return ctx.settings.seniorTechRevenueThresholdUsd;
  if (persona === "DEPARTMENT_LEADER") return ctx.settings.departmentLeaderRevenueThresholdUsd;
  return ctx.settings.executiveRevenueThresholdUsd;
}

function defaultRouteForPersona(persona: RoutingPersona, ctx: AttentionContext) {
  if (persona === "EXECUTIVE") return ctx.settings.executiveDefaultRoute;
  if (persona === "SENIOR_TECH_LEADER") return ctx.settings.seniorTechDefaultRoute;
  if (persona === "DEPARTMENT_LEADER") return ctx.settings.departmentLeaderDefaultRoute;
  if (persona === "OPERATOR") return ctx.settings.operatorDefaultRoute;
  return "DAILY_DIGEST" as const;
}

function pendingAreasForUser(ctx: AttentionContext, userId: string): string[] {
  return ctx.approvals
    .filter((a) => a.decision === "PENDING" && a.approver_user_id === userId)
    .map((a) => String(a.approval_area ?? "AREA"));
}

function userNamedExecPending(ctx: AttentionContext, userId: string): boolean {
  return ctx.approvals.some(
    (a) =>
      a.decision === "PENDING" &&
      String(a.approval_area ?? "").toUpperCase() === "EXEC" &&
      a.approver_user_id === userId
  );
}

function immediateForExecutive(args: {
  ctx: AttentionContext;
  userId: string;
  eventType: AttentionEventType;
  delegation: ReturnType<typeof delegateApproval>;
}): boolean {
  const { ctx, userId, eventType, delegation } = args;
  const v = ctx.view;
  if (eventType === "EXECUTIVE_OVERRIDE") return true;

  const threshold = personaRevenueThreshold("EXECUTIVE", ctx);
  const blocked = v.readiness.filter((r) => r.status === "BLOCKED").length;
  const revenueHigh = v.revenueAtRisk != null && v.revenueAtRisk >= threshold;
  const deployUrgent =
    deployUrgencyBucket(v.scheduledAt, ctx.settings.immediateDeployWindowHours, blocked > 0) !== "NONE";

  if (v.riskLevel === "HIGH" || v.riskLevel === "CRITICAL") return true;
  if (v.recommendation === "ESCALATE" || v.recommendation === "DELAY") return true;
  if (revenueHigh) return true;
  if (v.hasApprovalConflict) return true;
  if (ctx.executiveSignoffRequired && blocked > 0) return true;
  if (userNamedExecPending(ctx, userId)) return true;
  if (deployUrgent) return true;

  if (delegation.delegated && ctx.settings.suppressLowRiskExecNotifications) {
    return false;
  }

  return false;
}

function immediateForSeniorTech(ctx: AttentionContext, userId: string, eventType: AttentionEventType): boolean {
  if (eventType === "EXECUTIVE_OVERRIDE") return true;
  const v = ctx.view;
  const threshold = personaRevenueThreshold("SENIOR_TECH_LEADER", ctx);
  const blocked = v.readiness.some((r) => r.status === "BLOCKED");
  if (v.riskLevel === "HIGH" || v.riskLevel === "CRITICAL") return true;
  if (v.recommendation === "ESCALATE") return true;
  if (v.hasApprovalConflict) return true;
  if (blocked) return true;
  if (v.revenueAtRisk != null && v.revenueAtRisk >= threshold) return true;
  const areas = pendingAreasForUser(ctx, userId);
  if (areas.length > 0) return true;
  return false;
}

function immediateForDeptLeader(ctx: AttentionContext, userId: string): boolean {
  const v = ctx.view;
  const threshold = personaRevenueThreshold("DEPARTMENT_LEADER", ctx);
  const blocked = v.readiness.some((r) => r.status === "BLOCKED");
  if (blocked && pendingAreasForUser(ctx, userId).length > 0) return true;
  if (v.hasApprovalConflict) return true;
  if (v.revenueAtRisk != null && v.revenueAtRisk >= threshold) return true;
  return pendingAreasForUser(ctx, userId).length > 0;
}

function immediateForOperator(ctx: AttentionContext, userId: string): boolean {
  const v = ctx.view;
  if (ctx.createdByUserId === userId) {
    if (v.hasApprovalConflict || v.readiness.some((r) => r.status === "BLOCKED")) return true;
  }
  if (pendingAreasForUser(ctx, userId).length > 0) return true;
  const blocked = v.readiness.some((r) => r.status === "BLOCKED");
  const deployUrgent =
    deployUrgencyBucket(v.scheduledAt, ctx.settings.immediateDeployWindowHours, blocked) !== "NONE";
  if (deployUrgent) return true;
  return false;
}

function immediateForSubmitter(ctx: AttentionContext, userId: string, eventType: AttentionEventType): boolean {
  if (ctx.createdByUserId !== userId) return false;
  return (
    eventType === "APPROVAL_REQUIRED" ||
    eventType === "CHANGE_UPDATED" ||
    eventType === "EXECUTIVE_OVERRIDE"
  );
}

function pickChannel(persona: RoutingPersona, routeType: AttentionRoutingResult["routeType"]): AttentionChannel {
  if (routeType === "SUPPRESS") return "IN_APP";
  if (persona === "WATCHER") return "IN_APP";
  return "SLACK_DM";
}

function pickTemplate(persona: RoutingPersona, routeType: AttentionRoutingResult["routeType"]): DeliveryTemplate {
  if (routeType === "SUPPRESS") return "FYI";
  if (persona === "EXECUTIVE") return "EXECUTIVE_ALERT";
  if (persona === "SENIOR_TECH_LEADER" || persona === "DEPARTMENT_LEADER") return "APPROVAL_REQUEST";
  if (persona === "OPERATOR") return "OPERATOR_ALERT";
  if (routeType === "DAILY_DIGEST" || routeType === "WEEKLY_DIGEST") return "DIGEST_ITEM";
  return "FYI";
}

/**
 * Phase 2 attention router — pure; caller supplies AttentionContext (from buildAttentionContext).
 */
export function routeAttention(args: {
  eventType: AttentionEventType;
  triggeredByUserId?: string;
  context: AttentionContext;
}): AttentionRoutingResult[] {
  const { eventType, context: ctx } = args;
  const delegation = delegateApproval(ctx);
  const results: AttentionRoutingResult[] = [];

  for (const userId of ctx.candidateRecipientUserIds) {
    const member = ctx.members.find((m) => m.userId === userId);
    if (!member) continue;
    const persona = member.persona;

    const pendingAreas = pendingAreasForUser(ctx, userId);
    const driverInput: AttentionDriverInput = {
      view: ctx.view,
      userPendingApprovalAreas: pendingAreas,
      hasExecSignoffRequired: ctx.executiveSignoffRequired,
    };
    const primaryReasonCode = getPrimaryAttentionDriver(driverInput);
    const reason = getInterruptionReason(driverInput);

    let routeType: AttentionRouteType = defaultRouteForPersona(persona, ctx);
    let requiresAction = false;
    let actionType: AttentionRoutingResult["actionType"];

    if (persona === "EXECUTIVE") {
      const imm = immediateForExecutive({ ctx, userId, eventType, delegation });
      routeType = imm ? "IMMEDIATE" : routeType === "IMMEDIATE" ? "DAILY_DIGEST" : routeType;
      requiresAction = imm && (userNamedExecPending(ctx, userId) || ctx.executiveSignoffRequired);
      actionType = requiresAction ? "APPROVE" : imm ? "REVIEW" : "FYI";
      if (!imm && ctx.settings.suppressLowRiskExecNotifications && !ctx.executiveSignoffRequired) {
        routeType = "SUPPRESS";
      }
    } else if (persona === "SENIOR_TECH_LEADER") {
      const imm = immediateForSeniorTech(ctx, userId, eventType);
      routeType = imm ? "IMMEDIATE" : "DAILY_DIGEST";
      requiresAction = pendingAreas.length > 0;
      actionType = requiresAction ? "APPROVE" : imm ? "REVIEW" : "FYI";
      if (!imm && delegation.delegated) {
        routeType = "DAILY_DIGEST";
      }
    } else if (persona === "DEPARTMENT_LEADER") {
      const imm = immediateForDeptLeader(ctx, userId);
      routeType = imm ? "IMMEDIATE" : "DAILY_DIGEST";
      requiresAction = pendingAreas.length > 0;
      actionType = requiresAction ? "APPROVE" : "REVIEW";
    } else if (persona === "OPERATOR") {
      const imm = immediateForOperator(ctx, userId);
      routeType = imm ? "IMMEDIATE" : "DAILY_DIGEST";
      requiresAction = pendingAreas.length > 0;
      actionType = requiresAction ? "REVIEW" : "FYI";
    } else if (persona === "SUBMITTER") {
      const imm = immediateForSubmitter(ctx, userId, eventType);
      routeType = imm ? "IMMEDIATE" : "SUPPRESS";
      requiresAction = false;
      actionType = "FYI";
    } else {
      routeType = "DAILY_DIGEST";
      requiresAction = false;
      actionType = "FYI";
    }

    if (persona === "WATCHER") {
      routeType = "DAILY_DIGEST";
    }

    if (routeType === "DAILY_DIGEST" || routeType === "WEEKLY_DIGEST") {
      if (ctx.view.riskLevel === "MEDIUM" && !ctx.settings.digestIncludeMediumRisk) {
        routeType = "SUPPRESS";
      }
    }

    const channel = pickChannel(persona, routeType);
    const deliveryTemplate = pickTemplate(persona, routeType);

    results.push({
      userId,
      persona,
      routeType,
      channel,
      deliveryTemplate,
      requiresAction,
      actionType,
      reason,
      primaryReasonCode,
    });
  }

  return results;
}
