import type { PlanTier } from "@/services/billing/entitlements";

export type Phase4ThresholdSet = {
  /** Net-new qualifying business units vs baseline at Phase 4 start */
  businessUnitDelta: number;
  connectedIntegrations: number;
  enabledWorkflows: number;
  consecutiveExecutiveWeeks: number;
  /** Active departments factor target (renewal score denominator) */
  renewalDeptTarget: number;
  renewalValueStoryTarget: number;
  renewalExecutiveStreakTarget: number;
  renewalWeeklyUsageWeeksTarget: number;
  renewalWeeklyUsageWindowWeeks: number;
  /** Entry gate alternative: “enough active departments” */
  entryActiveDepartments: number;
};

export function phase4Thresholds(plan: PlanTier): Phase4ThresholdSet {
  if (plan === "BUSINESS") {
    return {
      businessUnitDelta: 2,
      connectedIntegrations: 5,
      enabledWorkflows: 5,
      consecutiveExecutiveWeeks: 4,
      renewalDeptTarget: 5,
      renewalValueStoryTarget: 5,
      renewalExecutiveStreakTarget: 4,
      renewalWeeklyUsageWeeksTarget: 4,
      renewalWeeklyUsageWindowWeeks: 6,
      entryActiveDepartments: 5,
    };
  }
  return {
    businessUnitDelta: 1,
    connectedIntegrations: 3,
    enabledWorkflows: 3,
    consecutiveExecutiveWeeks: 2,
    renewalDeptTarget: 3,
    renewalValueStoryTarget: 3,
    renewalExecutiveStreakTarget: 2,
    renewalWeeklyUsageWeeksTarget: 2,
    renewalWeeklyUsageWindowWeeks: 6,
    entryActiveDepartments: 3,
  };
}
