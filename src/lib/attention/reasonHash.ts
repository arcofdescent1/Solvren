import { createHash } from "node:crypto";
import type { AttentionEventType } from "./types";
import type { MaterialSnapshotV1 } from "./types";

export function normalizedMaterialStateString(s: MaterialSnapshotV1): string {
  return [
    s.recommendation,
    s.riskLevel,
    s.blockedCount,
    s.approvalConflict ? "1" : "0",
    s.revenueBand,
    s.deployUrgencyBucket,
    s.executiveOverlay,
  ].join("|");
}

export function computeAttentionReasonHash(args: {
  userId: string;
  changeId: string;
  eventType: AttentionEventType;
  primaryReasonCode: string;
  material: MaterialSnapshotV1;
}): string {
  const payload =
    args.userId +
    "|" +
    args.changeId +
    "|" +
    args.eventType +
    "|" +
    args.primaryReasonCode +
    "|" +
    normalizedMaterialStateString(args.material);
  return createHash("sha256").update(payload, "utf8").digest("hex").slice(0, 64);
}
