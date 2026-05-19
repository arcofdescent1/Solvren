import {
  buildLicenseEntitlements,
  isLicenseActive,
  normalizeLicenseTier,
  type LicenseTier,
} from "@/services/licensing";

export type PlanKey = LicenseTier;

export function isPaidActive(plan: PlanKey, status: string | null | undefined) {
  return isLicenseActive(status, normalizeLicenseTier(plan));
}

export function canUseSlack(plan: PlanKey, status: string | null | undefined) {
  return buildLicenseEntitlements({ tier: normalizeLicenseTier(plan), status }).capabilities.slack_notifications;
}

/** Email alerts (approval requested, overdue, etc.) - TEAM+ only */
export function canUseEmailNotifications(plan: PlanKey, status: string | null | undefined) {
  return buildLicenseEntitlements({ tier: normalizeLicenseTier(plan), status }).capabilities.email_notifications;
}

export function canUseWeeklyDigest(plan: PlanKey, status: string | null | undefined) {
  return buildLicenseEntitlements({ tier: normalizeLicenseTier(plan), status }).capabilities.weekly_digest;
}

export function canUseEscalations(plan: PlanKey, status: string | null | undefined) {
  return buildLicenseEntitlements({ tier: normalizeLicenseTier(plan), status }).capabilities.escalations;
}
