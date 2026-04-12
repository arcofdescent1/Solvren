/**
 * Guided Phase 1 onboarding — presentation-layer state (tracker remains authoritative for activation).
 */

export const GUIDED_FLOW_VERSION = "1" as const;

export type GuidedPhase1Status = "NOT_STARTED" | "IN_PROGRESS" | "RESULTS_READY" | "COMPLETED" | "SKIPPED";

export type GuidedStepKey = "welcome" | "business_context" | "integrations" | "use_cases" | "baseline_scan" | "results";

export const GUIDED_STEP_ORDER: GuidedStepKey[] = [
  "welcome",
  "business_context",
  "integrations",
  "use_cases",
  "baseline_scan",
  "results",
];

export type OnboardingIntegrationPresentationStatus =
  | "NOT_CONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "FAILED"
  | "ASSISTED_SETUP";

export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"] as const;
export type CompanySize = (typeof COMPANY_SIZES)[number];

export const INDUSTRIES = [
  "saas",
  "healthcare",
  "financial_services",
  "ecommerce",
  "manufacturing",
  "professional_services",
  "other",
] as const;
export type Industry = (typeof INDUSTRIES)[number];

export const PRIMARY_GOALS = [
  "protect_revenue",
  "improve_revops_efficiency",
  "reduce_operational_failures",
  "improve_cross_team_accountability",
] as const;
export type PrimaryGoal = (typeof PRIMARY_GOALS)[number];

export const ONBOARDING_USE_CASE_KEYS = [
  "duplicate_contacts",
  "failed_payments",
  "missing_lead_owners",
  "broken_handoffs",
  "scheduling_failures",
  "broken_automation",
  "subscription_churn",
  "crm_lifecycle_gaps",
] as const;
export type OnboardingUseCaseKey = (typeof ONBOARDING_USE_CASE_KEYS)[number];

export const ONBOARDING_PROVIDER_KEYS = ["hubspot", "salesforce", "stripe", "slack", "jira"] as const;
export type OnboardingProviderKey = (typeof ONBOARDING_PROVIDER_KEYS)[number];
