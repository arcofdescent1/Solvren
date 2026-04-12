import type { InternalEmployeeRole } from "./employeeRoles";

/** Fine-grained internal permissions (Phase 1 + Phase 2). */
export type InternalPermission =
  | "internal.accounts.view"
  | "internal.accounts.billing.view"
  | "internal.accounts.billing.manage"
  | "internal.accounts.team.manage"
  | "internal.accounts.onboarding.view"
  | "internal.accounts.onboarding.manage"
  | "internal.accounts.onboarding.override"
  | "internal.accounts.integrations.view"
  | "internal.accounts.integrations.manage"
  | "internal.accounts.diagnostics.view"
  | "internal.accounts.diagnostics.remediate";

const VIEW: InternalEmployeeRole[] = ["support_admin", "billing_support", "account_ops", "technical_support", "super_admin"];
const BILLING_VIEW: InternalEmployeeRole[] = ["support_admin", "billing_support", "account_ops", "technical_support", "super_admin"];
const BILLING_MANAGE: InternalEmployeeRole[] = ["billing_support", "account_ops", "super_admin"];
const TEAM: InternalEmployeeRole[] = ["support_admin", "account_ops", "super_admin"];

const ONBOARDING_VIEW: InternalEmployeeRole[] = ["support_admin", "account_ops", "technical_support", "super_admin"];
const ONBOARDING_MANAGE: InternalEmployeeRole[] = ["support_admin", "account_ops", "technical_support", "super_admin"];

/** Manual checklist overrides: account_ops, technical_support, super_admin only (§7.2). */
const ONBOARDING_OVERRIDE: InternalEmployeeRole[] = ["account_ops", "technical_support", "super_admin"];

const INTEGRATIONS_VIEW: InternalEmployeeRole[] = ["support_admin", "account_ops", "technical_support", "super_admin"];
const INTEGRATIONS_MANAGE: InternalEmployeeRole[] = ["support_admin", "account_ops", "technical_support", "super_admin"];

const DIAGNOSTICS_VIEW: InternalEmployeeRole[] = ["account_ops", "technical_support", "super_admin"];
const DIAGNOSTICS_REMEDIATE: InternalEmployeeRole[] = ["technical_support", "super_admin"];

const MAP: Record<InternalPermission, readonly InternalEmployeeRole[]> = {
  "internal.accounts.view": VIEW,
  "internal.accounts.billing.view": BILLING_VIEW,
  "internal.accounts.billing.manage": BILLING_MANAGE,
  "internal.accounts.team.manage": TEAM,
  "internal.accounts.onboarding.view": ONBOARDING_VIEW,
  "internal.accounts.onboarding.manage": ONBOARDING_MANAGE,
  "internal.accounts.onboarding.override": ONBOARDING_OVERRIDE,
  "internal.accounts.integrations.view": INTEGRATIONS_VIEW,
  "internal.accounts.integrations.manage": INTEGRATIONS_MANAGE,
  "internal.accounts.diagnostics.view": DIAGNOSTICS_VIEW,
  "internal.accounts.diagnostics.remediate": DIAGNOSTICS_REMEDIATE,
};

export function internalHasPermission(role: InternalEmployeeRole, permission: InternalPermission): boolean {
  return (MAP[permission] as readonly string[]).includes(role);
}

export type InternalWorkspaceTab =
  | "overview"
  | "onboarding"
  | "team_access"
  | "integrations"
  | "billing"
  | "diagnostics"
  | "audit";

/**
 * Tab visibility (§7.1). technical_support: no Team unless Phase 1 team.manage; no Billing.
 */
export function canAccessInternalTab(
  role: InternalEmployeeRole,
  tab: InternalWorkspaceTab,
  opts?: { teamManage?: boolean }
): boolean {
  const teamManage = Boolean(opts?.teamManage);

  if (role === "super_admin") return true;

  if (role === "billing_support") {
    return tab === "overview" || tab === "billing" || tab === "audit";
  }

  if (role === "support_admin") {
    if (tab === "diagnostics") return false;
    return (
      tab === "overview" ||
      tab === "team_access" ||
      tab === "billing" ||
      tab === "onboarding" ||
      tab === "integrations" ||
      tab === "audit"
    );
  }

  if (role === "account_ops") {
    return true;
  }

  if (role === "technical_support") {
    if (tab === "billing") return false;
    if (tab === "team_access") return teamManage;
    return (
      tab === "overview" ||
      tab === "onboarding" ||
      tab === "integrations" ||
      tab === "diagnostics" ||
      tab === "audit"
    );
  }

  return false;
}

/** Integration disable/enable: technical_support + super_admin only (§7.2). */
export function canDisableEnableIntegration(role: InternalEmployeeRole): boolean {
  return role === "technical_support" || role === "super_admin";
}
