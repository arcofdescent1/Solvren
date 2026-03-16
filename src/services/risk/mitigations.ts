export type BreakdownGroup<TSignal> = {
  category: string;
  total: number;
  items: TSignal[];
};

export type Mitigation = {
  level: "HIGH" | "VERY_HIGH";
  title: string;
  actions: string[];
};

export const MITIGATION_HINTS: Record<
  string,
  { title: string; whenHigh: string[]; whenVeryHigh: string[] }
> = {
  FINANCIAL_EXPOSURE: {
    title: "Financial Exposure",
    whenHigh: [
      "Require finance sign-off before release.",
      "Run invoice + subscription lifecycle test cases (new, upgrade, downgrade, cancel).",
      "Verify tax + discount edge cases in staging.",
    ],
    whenVeryHigh: [
      "Add a billing dry-run (staging) with real-like data and compare totals.",
      "Create a rollback plan for invoices/subscriptions (including reconciliation steps).",
    ],
  },
  CUSTOMER_IMPACT: {
    title: "Customer Impact",
    whenHigh: [
      "Require customer comms plan (who/when/what changes).",
      "Run billing test matrix: double-bill, under-bill, proration, renewals.",
      "Ensure support team has a FAQ + escalation path.",
    ],
    whenVeryHigh: [
      "Roll out via phased rollout (pilot cohort) or feature flag where possible.",
      "Prepare proactive monitoring: refunds, failed charges, support ticket volume.",
    ],
  },
  ROLLBACK_COMPLEXITY: {
    title: "Rollback Complexity",
    whenHigh: [
      "Write explicit rollback steps (owner + time estimate).",
      "Snapshot/config export before deploy (and store in change record).",
      "Confirm recovery plan for data corrections (who does what).",
    ],
    whenVeryHigh: [
      "Pre-stage a DB restore procedure and verify access + permissions.",
      "Schedule release window with on-call coverage and a stop/go checkpoint.",
    ],
  },
  DATA_INTEGRITY: {
    title: "Data Integrity",
    whenHigh: [
      "Require migration plan + backfill validation queries.",
      "Add field-level change log (renames/deletes) and update integrations.",
      "Run a post-deploy data reconciliation report.",
    ],
    whenVeryHigh: [
      "Perform migration rehearsal on a copy of production-like data.",
      "Freeze schema changes during rollout window to avoid conflicts.",
    ],
  },
  REPORTING_ACCURACY: {
    title: "Reporting Accuracy",
    whenHigh: [
      "Validate dashboards/metrics before and after deploy (MRR/churn/forecast).",
      "Notify stakeholders of any metric definition changes.",
      "Add temporary parallel reporting (old vs new) for 1–2 cycles.",
    ],
    whenVeryHigh: [
      "Require BI/RevOps approval on definitions and dashboards.",
      "Create a rollback plan for reporting changes (revert definitions + refresh).",
    ],
  },
  AUTOMATION_INTEGRATION: {
    title: "Automation / Integration",
    whenHigh: [
      "List every downstream workflow/webhook impacted and verify owners.",
      "Run end-to-end event tests (trigger → automation → CRM/billing).",
      "Add monitoring for webhook failures / integration errors.",
    ],
    whenVeryHigh: [
      "Temporarily throttle or gate new automations until stability is confirmed.",
      "Require a coordinated release checklist across systems.",
    ],
  },
};

export function prettyCategory(cat: string) {
  switch (cat) {
    case "FINANCIAL_EXPOSURE":
      return "Financial Exposure";
    case "DATA_INTEGRITY":
      return "Data Integrity";
    case "REPORTING_ACCURACY":
      return "Reporting Accuracy";
    case "CUSTOMER_IMPACT":
      return "Customer Impact";
    case "AUTOMATION_INTEGRATION":
      return "Automation / Integration";
    case "ROLLBACK_COMPLEXITY":
      return "Rollback Complexity";
    default:
      return cat;
  }
}

export function mitigationForCategory(
  category: string,
  total: number
): Mitigation | null {
  const HIGH = 4;
  const VERY_HIGH = 8;

  const entry = MITIGATION_HINTS[category];
  if (!entry) return null;

  if (total >= VERY_HIGH) {
    return {
      level: "VERY_HIGH",
      title: entry.title,
      actions: [...entry.whenHigh, ...entry.whenVeryHigh],
    };
  }
  if (total >= HIGH) {
    return {
      level: "HIGH",
      title: entry.title,
      actions: entry.whenHigh,
    };
  }
  return null;
}
