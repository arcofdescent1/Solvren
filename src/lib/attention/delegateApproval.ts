import type { AttentionContext } from "./types";

export type DelegationDecision = {
  delegated: boolean;
  delegatedToUserId?: string;
  delegatedFromUserId?: string;
  reason: string;
  visibilityMode: "FYI_ONLY" | "DIGEST_ONLY" | "NO_VISIBILITY";
};

function isTechnicalDomain(domain: string | null | undefined): boolean {
  const d = String(domain ?? "").toUpperCase();
  return d.includes("ENG") || d.includes("TECH") || d.includes("SOFTWARE") || d.includes("PLATFORM");
}

function operatorCapableUserIds(members: AttentionContext["members"]): Set<string> {
  const s = new Set<string>();
  for (const m of members) {
    if (m.persona === "OPERATOR" || m.persona === "DEPARTMENT_LEADER") {
      s.add(m.userId);
    }
  }
  return s;
}

function firstPendingNonExecApprover(approvals: AttentionContext["approvals"]): string | null {
  for (const a of approvals) {
    if (a.decision !== "PENDING") continue;
    const area = String(a.approval_area ?? "").toUpperCase();
    if (area === "EXEC") continue;
    if (a.approver_user_id) return a.approver_user_id;
  }
  return null;
}

function firstPendingDeptApprover(approvals: AttentionContext["approvals"]): string | null {
  for (const a of approvals) {
    if (a.decision !== "PENDING") continue;
    const area = String(a.approval_area ?? "").toUpperCase();
    if (area === "EXEC") continue;
    if (a.approver_user_id) return a.approver_user_id;
  }
  return null;
}

/**
 * Phase 2 delegation — advisory; does not mutate approvals. Caller persists when delegated.
 */
export function delegateApproval(ctx: AttentionContext): DelegationDecision {
  const v = ctx.view;
  const blocked = v.readiness.filter((r) => r.status === "BLOCKED").length;
  const lowMed = v.riskLevel === "LOW" || v.riskLevel === "MEDIUM";
  const noEscalate = v.recommendation !== "ESCALATE";
  const noConflict = !v.hasApprovalConflict;
  const revenueOk =
    v.revenueAtRisk == null ||
    v.revenueAtRisk < ctx.settings.executiveRevenueThresholdUsd;
  const overlayOk = v.executiveOverlay !== "DELAYED" && v.executiveOverlay !== "REQUESTED_INFO";

  if (!lowMed || !noEscalate || !noConflict || blocked > 0 || !revenueOk || !overlayOk) {
    return {
      delegated: false,
      reason: "Change does not meet delegation safety rules.",
      visibilityMode: "NO_VISIBILITY",
    };
  }

  const ops = operatorCapableUserIds(ctx.members);
  let target: string | null = null;
  if (isTechnicalDomain(ctx.domain)) {
    target = firstPendingNonExecApprover(ctx.approvals);
  } else {
    target = firstPendingDeptApprover(ctx.approvals);
  }

  if (!target && ctx.createdByUserId && ops.has(ctx.createdByUserId)) {
    target = ctx.createdByUserId;
  }
  if (!target && ctx.settings.fallbackOperatorUserId) {
    target = ctx.settings.fallbackOperatorUserId;
  }

  if (!target) {
    return {
      delegated: false,
      reason: "No eligible operator or approver found for delegation.",
      visibilityMode: "NO_VISIBILITY",
    };
  }

  return {
    delegated: true,
    delegatedToUserId: target,
    delegatedFromUserId: undefined,
    reason: "Low/medium risk with no blockers or conflicts; routed to existing operator/approver.",
    visibilityMode: "DIGEST_ONLY",
  };
}
