import { describe, it, expect } from "vitest";
import { normalizeRiskLevel } from "./riskLevel";

describe("normalizeRiskLevel", () => {
  it("maps VERY_HIGH to CRITICAL", () => {
    expect(normalizeRiskLevel("VERY_HIGH")).toBe("CRITICAL");
  });
  it("defaults unknown to MEDIUM", () => {
    expect(normalizeRiskLevel("")).toBe("MEDIUM");
  });
});
