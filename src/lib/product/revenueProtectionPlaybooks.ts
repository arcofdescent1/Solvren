export type RevenueProtectionPlaybook = {
  key: string;
  title: string;
  buyer: string;
  trigger: string;
  outcome: string;
  href: string;
  systems: string[];
};

export const REVENUE_PROTECTION_PLAYBOOKS: RevenueProtectionPlaybook[] = [
  {
    key: "pricing_packaging_change",
    title: "Pricing or packaging change",
    buyer: "CEO, CFO, RevOps, Engineering",
    trigger: "A pricing, packaging, promotion, or plan-logic change is ready to ship.",
    outcome: "Quantify MRR exposure, attach evidence, route executive approval, and verify no billing regression.",
    href: "/changes/new",
    systems: ["Stripe", "Salesforce", "HubSpot", "Product billing"],
  },
  {
    key: "billing_payment_degradation",
    title: "Billing or payment degradation",
    buyer: "CIO, CFO, RevOps",
    trigger: "Failed payments, invoice failures, checkout errors, or renewal friction spike.",
    outcome: "Assign remediation, monitor recovery, and record protected or recovered revenue.",
    href: "/issues",
    systems: ["Stripe", "NetSuite", "Slack", "Jira"],
  },
  {
    key: "entitlement_access_drift",
    title: "Entitlement or access drift",
    buyer: "CIO, CISO, Product leadership",
    trigger: "Plan access, feature flags, subscription state, or customer entitlement data diverges.",
    outcome: "Contain revenue leakage, preserve customer trust, and prove corrective action.",
    href: "/insights",
    systems: ["Product database", "CRM", "Billing", "Support"],
  },
  {
    key: "revenue_system_release",
    title: "Revenue-system release readiness",
    buyer: "Engineering executives, CIO",
    trigger: "A release touches checkout, billing, pricing, subscriptions, or revenue reporting.",
    outcome: "Check readiness, missing evidence, unresolved risks, and approval latency before rollout.",
    href: "/readiness",
    systems: ["GitHub", "Jira", "Stripe", "Data warehouse"],
  },
  {
    key: "pipeline_forecast_disruption",
    title: "Pipeline or forecast disruption",
    buyer: "CEO, CRO, RevOps",
    trigger: "CRM sync, lead routing, opportunity stage, or forecast data changes unexpectedly.",
    outcome: "Detect silent revenue-process breakage and show the business impact of remediation.",
    href: "/integrations",
    systems: ["Salesforce", "HubSpot", "Data warehouse", "Slack"],
  },
];
