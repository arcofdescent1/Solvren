import { normalizeImplementationMode, normalizeLicenseStatus, normalizeLicenseTier, normalizePremiumModules, normalizeProtectedRevenueBand } from "./normalize";
import { LICENSE_CAPABILITIES, type LicenseCapability, type LicenseEntitlements, type LicenseScope, type LicenseTier, type PremiumModule } from "./types";

function emptyCapabilities(): Record<LicenseCapability, boolean> {
  return Object.fromEntries(LICENSE_CAPABILITIES.map((capability) => [capability, false])) as Record<LicenseCapability, boolean>;
}

function includesModule(modules: PremiumModule[], module: PremiumModule): boolean {
  return modules.includes(module);
}

function tierRank(tier: LicenseTier): number {
  switch (tier) {
    case "STRATEGIC_ENTERPRISE":
      return 4;
    case "ENTERPRISE":
      return 3;
    case "BUSINESS":
      return 2;
    case "TEAM":
      return 1;
    case "FREE":
    default:
      return 0;
  }
}

function atLeast(tier: LicenseTier, minimum: LicenseTier): boolean {
  return tierRank(tier) >= tierRank(minimum);
}

export function buildLicenseEntitlements(scope: LicenseScope): LicenseEntitlements {
  const tier = normalizeLicenseTier(scope.tier);
  const status = normalizeLicenseStatus(scope.status);
  const active = tier !== "FREE" && (status === "ACTIVE" || status === "TRIALING" || status === "PAST_DUE");
  const premiumModules = normalizePremiumModules(scope.premiumModules);
  const implementationMode = normalizeImplementationMode(scope.implementationMode, tier);
  const capabilities = emptyCapabilities();

  if (active) {
    capabilities.slack_notifications = atLeast(tier, "TEAM");
    capabilities.email_notifications = atLeast(tier, "TEAM");
    capabilities.weekly_digest = atLeast(tier, "TEAM");
    capabilities.escalations = atLeast(tier, "BUSINESS");
    capabilities.executive_proof_packets = atLeast(tier, "BUSINESS");
    capabilities.customer_controlled_support_access = atLeast(tier, "ENTERPRISE");
    capabilities.sso = atLeast(tier, "ENTERPRISE");
    capabilities.multi_business_unit_governance = atLeast(tier, "ENTERPRISE") || includesModule(premiumModules, "MULTI_BUSINESS_UNIT");
    capabilities.advanced_integrations = atLeast(tier, "ENTERPRISE") || includesModule(premiumModules, "ADVANCED_INTEGRATIONS");
    capabilities.advanced_ai_assessment = atLeast(tier, "ENTERPRISE") || includesModule(premiumModules, "ADVANCED_AI");
    capabilities.board_ready_exports = atLeast(tier, "ENTERPRISE") || includesModule(premiumModules, "BOARD_REPORTING");
    capabilities.account_manager_rollout = atLeast(tier, "ENTERPRISE") || includesModule(premiumModules, "DEDICATED_SUCCESS");
    capabilities.strategic_governance = tier === "STRATEGIC_ENTERPRISE";
  }

  return {
    tier,
    status,
    active,
    protectedRevenueBand: normalizeProtectedRevenueBand(scope.protectedRevenueBand),
    implementationMode,
    unlimitedExecutiveAccess: scope.unlimitedExecutiveAccess ?? atLeast(tier, "BUSINESS"),
    includedAdminSeats: scope.includedAdminSeats ?? null,
    licensedBusinessUnits: scope.licensedBusinessUnits ?? null,
    licensedIntegrations: scope.licensedIntegrations ?? null,
    licensedDomains: scope.licensedDomains ?? null,
    premiumModules,
    capabilities,
  };
}

export function hasCapability(scope: LicenseScope, capability: LicenseCapability): boolean {
  return buildLicenseEntitlements(scope).capabilities[capability];
}
