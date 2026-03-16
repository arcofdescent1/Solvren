type SafeguardTemplate = {
  code: string;
  title: string;
  reason: string;
  required: boolean;
};

export const SAFEGUARD_LIBRARY: Record<string, SafeguardTemplate[]> = {
  BASELINE: [
    {
      code: "ROLLBACK_PLAN_REQUIRED",
      title: "Rollback plan",
      reason: "High-impact changes need a tested rollback plan before approval.",
      required: true,
    },
    {
      code: "MONITORING_PLAN_REQUIRED",
      title: "Monitoring plan",
      reason: "Release needs clear success/error monitors and alert ownership.",
      required: true,
    },
    {
      code: "POST_DEPLOYMENT_MONITORING_REQUIRED",
      title: "Post-deployment monitoring",
      reason: "Risky changes should include focused post-release monitoring windows.",
      required: false,
    },
  ],
  BILLING: [
    {
      code: "FINANCE_REVIEW_REQUIRED",
      title: "Finance review",
      reason: "Billing-impacting changes require Finance/RevOps sign-off.",
      required: true,
    },
    {
      code: "REVENUE_VALIDATION_REQUIRED",
      title: "Revenue validation checks",
      reason: "Run invoice/revenue validation checks before and after release.",
      required: true,
    },
  ],
  BACKFILL: [
    {
      code: "DATA_BACKFILL_VALIDATION_REQUIRED",
      title: "Backfill validation",
      reason: "Backfill needs reconciliation and sample validation before closure.",
      required: true,
    },
  ],
  ROLLOUT: [
    {
      code: "PHASED_ROLLOUT_RECOMMENDED",
      title: "Phased rollout",
      reason: "Gradual rollout reduces blast radius and improves recoverability.",
      required: false,
    },
  ],
};

export const DEFAULT_APPROVAL_ROLES = [
  { role: "RevOps", reason: "Revenue operations oversight for business-impacting changes." },
  { role: "Engineering", reason: "Technical ownership and implementation accountability." },
];
