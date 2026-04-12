import { trackAppEvent } from "@/lib/appAnalytics";
import { phase3AnalyticsBase } from "@/modules/onboarding/phase3/phase3-analytics-payload";

export const phase3BasePayload = phase3AnalyticsBase;

export function trackPhase3StepViewed(
  orgId: string,
  phase3Status: string | null | undefined,
  currentStepKey: string | null | undefined,
  stepKey: string
) {
  trackAppEvent("onboarding_phase3_step_viewed", {
    ...phase3BasePayload(orgId, phase3Status, currentStepKey),
    stepKey,
  });
}
