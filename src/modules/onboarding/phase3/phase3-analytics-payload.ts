export function phase3AnalyticsBase(
  orgId: string,
  phase3Status: string | null | undefined,
  currentStepKey: string | null | undefined
) {
  return {
    orgId,
    phase3Status: phase3Status ?? "UNKNOWN",
    currentStepKey: currentStepKey ?? "",
  };
}
