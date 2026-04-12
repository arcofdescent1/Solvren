import { trackAppEvent } from "@/lib/appAnalytics";
import { phase2AnalyticsBase } from "@/modules/onboarding/phase2/phase2-analytics-payload";

export const phase2BasePayload = phase2AnalyticsBase;

export function trackPhase2StepViewed(
  orgId: string,
  phase2Status: string | null | undefined,
  currentStepKey: string | null | undefined,
  stepKey: string
) {
  trackAppEvent("onboarding_phase2_step_viewed", {
    ...phase2BasePayload(orgId, phase2Status, currentStepKey),
    stepKey,
  });
}
