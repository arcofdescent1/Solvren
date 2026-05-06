import { describe, it, expect } from "vitest";
import { deriveExecutiveOverlayState } from "./executiveOverlayState";

describe("deriveExecutiveOverlayState", () => {
  it("uses the latest decision by time", () => {
    expect(
      deriveExecutiveOverlayState([
        { decision: "DENY", created_at: "2026-01-02T00:00:00Z" },
        { decision: "APPROVE", created_at: "2026-01-03T00:00:00Z" },
      ])
    ).toBe("APPROVED");
  });

  it("maps DENY to DENIED", () => {
    expect(
      deriveExecutiveOverlayState([{ decision: "DENY", created_at: "2026-01-03T00:00:00Z" }])
    ).toBe("DENIED");
  });
});
