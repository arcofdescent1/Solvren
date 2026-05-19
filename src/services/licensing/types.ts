export const LICENSE_TIERS = ["FREE", "TEAM", "BUSINESS", "ENTERPRISE", "STRATEGIC_ENTERPRISE"] as const;
export type LicenseTier = (typeof LICENSE_TIERS)[number];

export const PROTECTED_REVENUE_BANDS = ["UNSET", "UNDER_25M", "25M_100M", "100M_250M", "250M_1B", "1B_PLUS"] as const;
export type ProtectedRevenueBand = (typeof PROTECTED_REVENUE_BANDS)[number];

export const LICENSE_STATUSES = ["ACTIVE", "TRIALING", "PAST_DUE", "INCOMPLETE", "CANCELED"] as const;
export type LicenseStatus = (typeof LICENSE_STATUSES)[number];

export const IMPLEMENTATION_MODES = ["SELF_SERVE", "GUIDED", "WHITE_GLOVE"] as const;
export type ImplementationMode = (typeof IMPLEMENTATION_MODES)[number];

export const PREMIUM_MODULES = [
  "ADVANCED_AI",
  "BOARD_REPORTING",
  "ADVANCED_SECURITY",
  "MULTI_BUSINESS_UNIT",
  "ADVANCED_INTEGRATIONS",
  "DEDICATED_SUCCESS",
] as const;
export type PremiumModule = (typeof PREMIUM_MODULES)[number];

export const LICENSE_CAPABILITIES = [
  "slack_notifications",
  "email_notifications",
  "weekly_digest",
  "escalations",
  "sso",
  "customer_controlled_support_access",
  "executive_proof_packets",
  "advanced_ai_assessment",
  "board_ready_exports",
  "multi_business_unit_governance",
  "advanced_integrations",
  "account_manager_rollout",
  "strategic_governance",
] as const;
export type LicenseCapability = (typeof LICENSE_CAPABILITIES)[number];

export type LicenseScope = {
  tier: LicenseTier;
  status?: string | null;
  protectedRevenueBand?: ProtectedRevenueBand | null;
  licensedBusinessUnits?: number | null;
  licensedIntegrations?: string[] | null;
  licensedDomains?: string[] | null;
  includedAdminSeats?: number | null;
  unlimitedExecutiveAccess?: boolean | null;
  premiumModules?: string[] | null;
  implementationMode?: ImplementationMode | null;
  accountManagerUserId?: string | null;
  customerSuccessOwnerUserId?: string | null;
  contractStart?: string | null;
  contractEnd?: string | null;
  renewalDate?: string | null;
  orderFormReference?: string | null;
};

export type LicenseEntitlements = {
  tier: LicenseTier;
  status: LicenseStatus;
  active: boolean;
  protectedRevenueBand: ProtectedRevenueBand;
  implementationMode: ImplementationMode;
  unlimitedExecutiveAccess: boolean;
  includedAdminSeats: number | null;
  licensedBusinessUnits: number | null;
  licensedIntegrations: string[] | null;
  licensedDomains: string[] | null;
  premiumModules: PremiumModule[];
  capabilities: Record<LicenseCapability, boolean>;
};
