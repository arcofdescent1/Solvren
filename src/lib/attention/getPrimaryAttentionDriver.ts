import type { ExecutiveChangeView } from "@/lib/executive/types";
import type { AttentionDriverCode } from "./types";

export type AttentionDriverInput = {
  view: ExecutiveChangeView;
  /** User-specific: pending approval assigned to this user */
  userPendingApprovalAreas: string[];
  hasExecSignoffRequired: boolean;
};

export type RankedDriver = { code: AttentionDriverCode; priority: number };

/**
 * Shared priority stack for Slack subtitle, executive page bullets, and preview.
 * Lower priority number = more important (processed first).
 */
const ORDER: AttentionDriverCode[] = [
  "DIRECT_APPROVAL_REQUIRED",
  "CONFLICT_JUDGMENT",
  "READINESS_BLOCKED_DOMAIN",
  "EXEC_OVERLAY_BLOCK",
  "RECOMMENDATION_ESCALATE",
  "RECOMMENDATION_DELAY",
  "HIGH_RISK",
  "OPEN_INCIDENT",
  "REVENUE_THRESHOLD",
  "DEPLOY_URGENCY",
  "DIGEST_FYI",
  "ROUTINE",
];

function rankOf(code: AttentionDriverCode): number {
  const i = ORDER.indexOf(code);
  return i === -1 ? 99 : i;
}

export function collectAttentionDrivers(input: AttentionDriverInput): RankedDriver[] {
  const { view, userPendingApprovalAreas, hasExecSignoffRequired } = input;
  const hits = new Set<AttentionDriverCode>();

  if (userPendingApprovalAreas.length > 0) {
    hits.add("DIRECT_APPROVAL_REQUIRED");
  }
  if (view.hasApprovalConflict) {
    hits.add("CONFLICT_JUDGMENT");
  }
  const blocked = view.readiness.filter((r) => r.status === "BLOCKED");
  if (blocked.length > 0) {
    hits.add("READINESS_BLOCKED_DOMAIN");
  }
  if (view.executiveOverlay === "DELAYED" || view.executiveOverlay === "REQUESTED_INFO") {
    hits.add("EXEC_OVERLAY_BLOCK");
  }
  if (view.recommendation === "ESCALATE") {
    hits.add("RECOMMENDATION_ESCALATE");
  }
  if (view.recommendation === "DELAY") {
    hits.add("RECOMMENDATION_DELAY");
  }
  if (view.riskLevel === "HIGH" || view.riskLevel === "CRITICAL") {
    hits.add("HIGH_RISK");
  }
  if (view.technicalDetails.incidents.length > 0) {
    hits.add("OPEN_INCIDENT");
  }
  if (
    view.revenueAtRisk != null &&
    view.revenueAtRisk >= view.revenueEscalationThresholdUsd
  ) {
    hits.add("REVENUE_THRESHOLD");
  }

  const due = view.scheduledAt ? Date.parse(view.scheduledAt) : NaN;
  if (Number.isFinite(due)) {
    const hours = (due - Date.now()) / 3_600_000;
    if (hours <= 24 && hours >= 0 && blocked.length > 0) {
      hits.add("DEPLOY_URGENCY");
    }
  }

  if (hits.size === 0) {
    if (view.recommendation === "PROCEED_WITH_CAUTION") {
      hits.add("DIGEST_FYI");
    } else {
      hits.add("ROUTINE");
    }
  }

  return Array.from(hits)
    .map((code) => ({ code, priority: rankOf(code) }))
    .sort((a, b) => a.priority - b.priority);
}

export function getPrimaryAttentionDriver(input: AttentionDriverInput): AttentionDriverCode {
  const ranked = collectAttentionDrivers(input);
  return ranked[0]?.code ?? "ROUTINE";
}
