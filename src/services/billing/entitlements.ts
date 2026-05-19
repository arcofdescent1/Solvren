import {
  buildLicenseEntitlements,
  isLicenseActive,
  normalizeLicenseTier,
  type LicenseTier,
} from "@/services/licensing";

export type PlanTier = LicenseTier;

/** Normalize legacy plan strings into canonical licensing tiers. */
export function planFromString(v: unknown): PlanTier {
  return normalizeLicenseTier(v);
}

export function isPaidActive(plan: PlanTier, status?: string | null): boolean {
  return isLicenseActive(status, plan);
}

export function canUseSlack(plan: PlanTier, status?: string | null) {
  return buildLicenseEntitlements({ tier: plan, status }).capabilities.slack_notifications;
}

export function canUseEmail(plan: PlanTier, status?: string | null) {
  return buildLicenseEntitlements({ tier: plan, status }).capabilities.email_notifications;
}

export function canUseWeeklyDigest(plan: PlanTier, status?: string | null) {
  return buildLicenseEntitlements({ tier: plan, status }).capabilities.weekly_digest;
}
