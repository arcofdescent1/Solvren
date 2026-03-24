import { describe, expect, it } from "vitest";
import { SimulationConfidenceBand, scoreToBand } from "./simulation-confidence-band";

describe("Phase 2 — simulation confidence bands", () => {
  it("maps scores to stable bands", () => {
    expect(scoreToBand(95)).toBe(SimulationConfidenceBand.VERY_HIGH);
    expect(scoreToBand(80)).toBe(SimulationConfidenceBand.HIGH);
    expect(scoreToBand(60)).toBe(SimulationConfidenceBand.MODERATE);
    expect(scoreToBand(30)).toBe(SimulationConfidenceBand.LOW);
    expect(scoreToBand(10)).toBe(SimulationConfidenceBand.VERY_LOW);
  });
});
