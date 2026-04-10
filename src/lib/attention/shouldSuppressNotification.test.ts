import { describe, it, expect } from "vitest";
import { shouldSuppressAttentionNotification, ATTENTION_SUPPRESS_WINDOW_MS } from "./shouldSuppressNotification";
import type { MaterialSnapshotV1 } from "./types";

const baseMat = (): MaterialSnapshotV1 => ({
  recommendation: "PROCEED",
  riskLevel: "LOW",
  blockedCount: 0,
  approvalConflict: false,
  revenueBand: "NONE",
  deployUrgencyBucket: "NONE",
  executiveOverlay: "NONE",
  primaryReasonCode: "ROUTINE",
});

describe("shouldSuppressAttentionNotification", () => {
  it("suppresses duplicate hash within 6h", () => {
    const now = Date.now();
    const mat = baseMat();
    expect(
      shouldSuppressAttentionNotification({
        eventType: "APPROVAL_REQUIRED",
        nowMs: now,
        last: {
          createdAtMs: now - 60_000,
          reasonHash: "abc",
          material: mat,
        },
        nextReasonHash: "abc",
        nextMaterial: mat,
      })
    ).toBe(true);
  });

  it("allows after window", () => {
    const now = Date.now();
    const mat = baseMat();
    expect(
      shouldSuppressAttentionNotification({
        eventType: "APPROVAL_REQUIRED",
        nowMs: now,
        last: {
          createdAtMs: now - ATTENTION_SUPPRESS_WINDOW_MS - 1,
          reasonHash: "abc",
          material: mat,
        },
        nextReasonHash: "abc",
        nextMaterial: mat,
      })
    ).toBe(false);
  });
});
