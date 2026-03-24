import { describe, expect, it } from "vitest";
import { cutoffIsoFromRetentionDays } from "@/lib/server/runDataRetentionSweep";

describe("cutoffIsoFromRetentionDays", () => {
  it("subtracts whole UTC days from a fixed instant", () => {
    const now = new Date("2025-06-15T12:00:00.000Z");
    const cut = cutoffIsoFromRetentionDays(7, now);
    expect(cut).toBe("2025-06-08T12:00:00.000Z");
  });
});
