type FailureModeTemplate = {
  title: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  likelihood: "LOW" | "MEDIUM" | "HIGH";
  signals: string[];
};

export const FAILURE_MODE_LIBRARY: Record<string, FailureModeTemplate[]> = {
  PRICING: [
    {
      title: "Incorrect invoice totals",
      description: "Pricing/rate updates can produce mismatched invoice totals across checkout and billing.",
      severity: "HIGH",
      likelihood: "MEDIUM",
      signals: ["CHANGE_TYPE_PRICING", "BILLING_SURFACE_TOUCH"],
    },
    {
      title: "Discount logic regression",
      description: "Discount and promotion rules may apply incorrectly across segments.",
      severity: "HIGH",
      likelihood: "MEDIUM",
      signals: ["CHANGE_TYPE_PRICING", "CUSTOMER_IMPACT_EXPECTED"],
    },
  ],
  BILLING_LOGIC: [
    {
      title: "Invoices not generated",
      description: "Billing pipeline can fail to issue invoices in expected cycles.",
      severity: "CRITICAL",
      likelihood: "MEDIUM",
      signals: ["CHANGE_TYPE_BILLING_LOGIC", "CRITICAL_SYSTEM_STRIPE"],
    },
    {
      title: "Duplicate billing",
      description: "Retry/idempotency regressions can charge customers multiple times.",
      severity: "CRITICAL",
      likelihood: "LOW",
      signals: ["CHANGE_TYPE_BILLING_LOGIC", "IMMEDIATE_ROLLOUT"],
    },
    {
      title: "Plan state divergence",
      description: "Billing state may diverge from CRM/entitlements after update.",
      severity: "HIGH",
      likelihood: "MEDIUM",
      signals: ["CHANGE_TYPE_BILLING_LOGIC", "SYSTEMS_COUNT_HIGH"],
    },
  ],
  REVENUE_RECOGNITION: [
    {
      title: "Revenue recognition misclassification",
      description: "Recognition rules may misclassify timing/category of revenue.",
      severity: "CRITICAL",
      likelihood: "LOW",
      signals: ["CHANGE_TYPE_REVENUE_RECOGNITION", "DOMAIN_FINANCE"],
    },
    {
      title: "Financial reporting discrepancies",
      description: "Dashboard and finance reports may diverge after rev rec logic changes.",
      severity: "HIGH",
      likelihood: "MEDIUM",
      signals: ["CHANGE_TYPE_REVENUE_RECOGNITION", "REPORTING_IMPACT"],
    },
  ],
  LEAD_ROUTING: [
    {
      title: "Lead assignment errors",
      description: "Leads may route to incorrect owners/queues, reducing conversion.",
      severity: "MEDIUM",
      likelihood: "MEDIUM",
      signals: ["CHANGE_TYPE_LEAD_ROUTING", "SYSTEMS_COUNT_HIGH"],
    },
    {
      title: "Attribution distortion",
      description: "Reporting attribution can break across downstream systems.",
      severity: "MEDIUM",
      likelihood: "MEDIUM",
      signals: ["CHANGE_TYPE_LEAD_ROUTING", "REPORTING_IMPACT"],
    },
  ],
  DEFAULT: [
    {
      title: "Cross-system data mismatch",
      description: "Changes can create divergence between source and downstream systems.",
      severity: "MEDIUM",
      likelihood: "MEDIUM",
      signals: ["SYSTEMS_COUNT_HIGH"],
    },
  ],
};
