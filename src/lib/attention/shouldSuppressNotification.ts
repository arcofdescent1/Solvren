import type { AttentionEventType } from "./types";
import type { MaterialSnapshotV1 } from "./types";
import { isMateriallyWorsened } from "./materialSnapshot";

export const ATTENTION_SUPPRESS_WINDOW_MS = 6 * 60 * 60 * 1000;

export type LastDeliveryRecord = {
  createdAtMs: number;
  reasonHash: string;
  material: MaterialSnapshotV1 | null;
};

export function shouldSuppressAttentionNotification(args: {
  eventType: AttentionEventType;
  nowMs: number;
  last: LastDeliveryRecord | null;
  nextReasonHash: string;
  nextMaterial: MaterialSnapshotV1;
}): boolean {
  if (!args.last) return false;
  const elapsed = args.nowMs - args.last.createdAtMs;
  if (elapsed >= ATTENTION_SUPPRESS_WINDOW_MS) return false;

  if (isMateriallyWorsened(args.last.material, args.nextMaterial)) {
    return false;
  }

  if (args.eventType === "EXECUTIVE_OVERRIDE") {
    return args.last.reasonHash === args.nextReasonHash;
  }

  return args.last.reasonHash === args.nextReasonHash;
}
