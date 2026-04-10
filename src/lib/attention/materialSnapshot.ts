import type { ExecutiveChangeView } from "@/lib/executive/types";
import type { AttentionDriverCode, MaterialSnapshotV1, OrgAttentionSettingsResolved } from "./types";

function revenueBandForPersona(
  revenue: number | null,
  _settings: OrgAttentionSettingsResolved,
  personaThreshold: number
): MaterialSnapshotV1["revenueBand"] {
  if (revenue == null || !Number.isFinite(revenue)) return "NONE";
  if (revenue >= personaThreshold * 1.25) return "HIGH";
  if (revenue >= personaThreshold) return "MID";
  if (revenue >= personaThreshold * 0.5) return "LOW";
  return "NONE";
}

export function deployUrgencyBucket(
  scheduledAt: string | null,
  windowHours: number,
  hasUnresolvedBlockers: boolean
): MaterialSnapshotV1["deployUrgencyBucket"] {
  if (!hasUnresolvedBlockers) return "NONE";
  if (!scheduledAt) return "NONE";
  const due = Date.parse(scheduledAt);
  if (!Number.isFinite(due)) return "NONE";
  const hours = (due - Date.now()) / 3_600_000;
  if (hours < 0) return "IMMINENT";
  if (hours <= windowHours) return "IMMINENT";
  if (hours <= windowHours * 2) return "SOON";
  return "NONE";
}

const REC_ORDER: ExecutiveChangeView["recommendation"][] = [
  "PROCEED",
  "PROCEED_WITH_CAUTION",
  "DELAY",
  "ESCALATE",
];

function recRank(r: ExecutiveChangeView["recommendation"]): number {
  const i = REC_ORDER.indexOf(r);
  return i === -1 ? 0 : i;
}

export function buildMaterialSnapshot(args: {
  view: ExecutiveChangeView;
  settings: OrgAttentionSettingsResolved;
  personaRevenueThreshold: number;
  primaryReasonCode: AttentionDriverCode;
}): MaterialSnapshotV1 {
  const { view, settings, personaRevenueThreshold, primaryReasonCode } = args;
  const blockedCount = view.readiness.filter((r) => r.status === "BLOCKED").length;
  return {
    recommendation: view.recommendation,
    riskLevel: view.riskLevel,
    blockedCount,
    approvalConflict: view.hasApprovalConflict,
    revenueBand: revenueBandForPersona(view.revenueAtRisk, settings, personaRevenueThreshold),
    deployUrgencyBucket: deployUrgencyBucket(
      view.scheduledAt,
      settings.immediateDeployWindowHours,
      blockedCount > 0
    ),
    executiveOverlay: view.executiveOverlay,
    primaryReasonCode,
  };
}

export function isMateriallyWorsened(prev: MaterialSnapshotV1 | null, next: MaterialSnapshotV1): boolean {
  if (!prev) return true;
  if (recRank(next.recommendation) > recRank(prev.recommendation)) return true;

  const riskOrder = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
  if (riskOrder[next.riskLevel] > riskOrder[prev.riskLevel]) return true;
  if (next.blockedCount > prev.blockedCount) return true;
  if (next.approvalConflict && !prev.approvalConflict) return true;

  const bandOrder = { NONE: 0, LOW: 1, MID: 2, HIGH: 3 };
  if (bandOrder[next.revenueBand] > bandOrder[prev.revenueBand]) return true;

  const depOrder = { NONE: 0, SOON: 1, IMMINENT: 2 };
  if (depOrder[next.deployUrgencyBucket] > depOrder[prev.deployUrgencyBucket] && next.blockedCount > 0) {
    return true;
  }

  const overlayWorse =
    (prev.executiveOverlay === "NONE" || prev.executiveOverlay === "APPROVED") &&
    (next.executiveOverlay === "DELAYED" || next.executiveOverlay === "REQUESTED_INFO");
  if (overlayWorse) return true;

  return false;
}
