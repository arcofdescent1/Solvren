import type { CoordinationEvidenceSource } from "./coordinationTypes";

export type EvidenceRuleItem = {
  kind: string;
  title: string;
  reason: string;
  source: CoordinationEvidenceSource;
  required: boolean;
};

export const CHANGE_TYPE_EVIDENCE_RULES: Record<string, EvidenceRuleItem[]> = {
  pricing: [
    {
      kind: "REVENUE_VALIDATION",
      title: "Revenue validation checks",
      reason: "Pricing updates require before/after revenue validation.",
      source: "CHANGE_TYPE_RULE",
      required: true,
    },
    {
      kind: "ROLLBACK",
      title: "Rollback plan",
      reason: "Pricing changes need rollback readiness.",
      source: "CHANGE_TYPE_RULE",
      required: true,
    },
    {
      kind: "TEST_PLAN",
      title: "Pricing scenario test plan",
      reason: "Pricing variants and discount paths must be validated.",
      source: "CHANGE_TYPE_RULE",
      required: true,
    },
    {
      kind: "COMMS_PLAN",
      title: "Stakeholder communication plan",
      reason: "Pricing changes often require internal/external communication.",
      source: "CHANGE_TYPE_RULE",
      required: false,
    },
  ],
  "billing logic": [
    {
      kind: "TEST_PLAN",
      title: "Billing flow test plan",
      reason: "Billing logic must be validated across invoice scenarios.",
      source: "CHANGE_TYPE_RULE",
      required: true,
    },
    {
      kind: "ROLLBACK",
      title: "Rollback plan",
      reason: "Billing changes need explicit rollback criteria and steps.",
      source: "CHANGE_TYPE_RULE",
      required: true,
    },
    {
      kind: "MONITORING_PLAN",
      title: "Monitoring plan",
      reason: "Billing changes require targeted runtime monitoring.",
      source: "CHANGE_TYPE_RULE",
      required: true,
    },
  ],
  "revenue recognition": [
    {
      kind: "REPORTING_VALIDATION",
      title: "Reporting validation evidence",
      reason: "Revenue recognition impacts finance reporting outputs.",
      source: "CHANGE_TYPE_RULE",
      required: true,
    },
    {
      kind: "FINANCE_SIGNOFF",
      title: "Finance sign-off evidence",
      reason: "Finance governance is required for recognition rule updates.",
      source: "CHANGE_TYPE_RULE",
      required: true,
    },
  ],
  "lead routing": [
    {
      kind: "ROUTING_VALIDATION",
      title: "Routing validation results",
      reason: "Lead routing changes need routing scenario proof.",
      source: "CHANGE_TYPE_RULE",
      required: true,
    },
    {
      kind: "REPORTING_CHECK",
      title: "Attribution/reporting check",
      reason: "Routing impacts funnel reporting and attribution.",
      source: "CHANGE_TYPE_RULE",
      required: true,
    },
  ],
};

export const SYSTEM_EVIDENCE_RULES: Record<string, EvidenceRuleItem[]> = {
  stripe: [
    {
      kind: "PAYMENT_VALIDATION",
      title: "Payment flow validation",
      reason: "Stripe-related updates require payment path validation.",
      source: "SYSTEM_RULE",
      required: true,
    },
  ],
  netsuite: [
    {
      kind: "REPORTING_VALIDATION",
      title: "Downstream reporting validation",
      reason: "NetSuite integrations require finance/reporting checks.",
      source: "SYSTEM_RULE",
      required: true,
    },
  ],
  hubspot: [
    {
      kind: "ATTRIBUTION_VALIDATION",
      title: "Routing/attribution validation",
      reason: "HubSpot workflow changes affect routing and attribution.",
      source: "SYSTEM_RULE",
      required: true,
    },
  ],
};

export const DOMAIN_EVIDENCE_RULES: Record<string, EvidenceRuleItem[]> = {
  finance: [
    {
      kind: "FINANCE_REVIEW_EVIDENCE",
      title: "Finance review evidence",
      reason: "Finance domain changes require explicit review evidence.",
      source: "DOMAIN_RULE",
      required: true,
    },
  ],
  data: [
    {
      kind: "RECONCILIATION_PLAN",
      title: "Data reconciliation plan",
      reason: "Data domain changes should include reconciliation approach.",
      source: "DOMAIN_RULE",
      required: true,
    },
  ],
};
