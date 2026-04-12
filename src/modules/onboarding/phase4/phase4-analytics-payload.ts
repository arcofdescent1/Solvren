export function phase4AnalyticsBase(
  orgId: string,
  phase4Status: string | null | undefined,
  currentStepKey: string | null | undefined
) {
  return {
    orgId,
    phase4Status: phase4Status ?? "UNKNOWN",
    currentStepKey: currentStepKey ?? "",
  };
}
