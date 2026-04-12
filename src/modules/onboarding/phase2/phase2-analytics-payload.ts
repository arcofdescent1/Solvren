/** Shared Phase 2 analytics contract (client + server). */
export function phase2AnalyticsBase(
  orgId: string,
  phase2Status: string | null | undefined,
  currentStepKey: string | null | undefined
) {
  return {
    orgId,
    phase2Status: phase2Status ?? "UNKNOWN",
    currentStepKey: currentStepKey ?? "",
  };
}
