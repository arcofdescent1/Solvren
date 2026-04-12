import { describe, expect, it } from "vitest";
import { onboardingPhaseSummaryFromState } from "./onboardingPhaseSummary";

describe("onboardingPhaseSummaryFromState", () => {
  it("returns not_started when row missing", () => {
    expect(onboardingPhaseSummaryFromState(null)).toBe("not_started");
  });

  it("returns phase_1_in_progress when phase1 in progress", () => {
    expect(
      onboardingPhaseSummaryFromState({
        guided_phase1_status: "IN_PROGRESS",
      })
    ).toBe("phase_1_in_progress");
  });

  it("returns phase_2_in_progress when phase1 done and phase2 open", () => {
    expect(
      onboardingPhaseSummaryFromState({
        guided_phase1_status: "COMPLETED",
        phase2_status: null,
      })
    ).toBe("phase_2_in_progress");
  });

  it("returns complete when all phases done", () => {
    expect(
      onboardingPhaseSummaryFromState({
        guided_phase1_status: "COMPLETED",
        phase2_status: "COMPLETED",
        phase3_status: "SKIPPED",
        phase4_status: "COMPLETED",
      })
    ).toBe("complete");
  });
});
