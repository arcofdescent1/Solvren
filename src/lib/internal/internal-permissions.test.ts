import { describe, expect, it } from "vitest";
import { canAccessInternalTab, canDisableEnableIntegration, internalHasPermission } from "./permissions";

describe("internalHasPermission", () => {
  it("denies billing.manage for support_admin", () => {
    expect(internalHasPermission("support_admin", "internal.accounts.billing.manage")).toBe(false);
  });

  it("allows billing.manage for billing_support", () => {
    expect(internalHasPermission("billing_support", "internal.accounts.billing.manage")).toBe(true);
  });

  it("allows billing.view for support_admin", () => {
    expect(internalHasPermission("support_admin", "internal.accounts.billing.view")).toBe(true);
  });

  it("denies team.manage for billing_support", () => {
    expect(internalHasPermission("billing_support", "internal.accounts.team.manage")).toBe(false);
  });

  it("allows diagnostics.remediate only for technical_support and super_admin", () => {
    expect(internalHasPermission("technical_support", "internal.accounts.diagnostics.remediate")).toBe(true);
    expect(internalHasPermission("super_admin", "internal.accounts.diagnostics.remediate")).toBe(true);
    expect(internalHasPermission("account_ops", "internal.accounts.diagnostics.remediate")).toBe(false);
    expect(internalHasPermission("support_admin", "internal.accounts.diagnostics.remediate")).toBe(false);
  });

  it("denies onboarding.override for support_admin", () => {
    expect(internalHasPermission("support_admin", "internal.accounts.onboarding.override")).toBe(false);
  });

  it("allows onboarding.override for technical_support", () => {
    expect(internalHasPermission("technical_support", "internal.accounts.onboarding.override")).toBe(true);
  });
});

describe("canAccessInternalTab (Phase 2 matrix)", () => {
  const tabs = [
    "overview",
    "onboarding",
    "team_access",
    "integrations",
    "billing",
    "diagnostics",
    "audit",
  ] as const;

  it("billing_support: overview, billing, audit only", () => {
    for (const tab of tabs) {
      const ok = tab === "overview" || tab === "billing" || tab === "audit";
      expect(canAccessInternalTab("billing_support", tab)).toBe(ok);
    }
  });

  it("support_admin: all except diagnostics", () => {
    for (const tab of tabs) {
      expect(canAccessInternalTab("support_admin", tab)).toBe(tab !== "diagnostics");
    }
  });

  it("account_ops: all tabs", () => {
    for (const tab of tabs) {
      expect(canAccessInternalTab("account_ops", tab)).toBe(true);
    }
  });

  it("technical_support: no billing; team_access only with team.manage", () => {
    expect(canAccessInternalTab("technical_support", "billing")).toBe(false);
    expect(canAccessInternalTab("technical_support", "team_access")).toBe(false);
    expect(canAccessInternalTab("technical_support", "team_access", { teamManage: true })).toBe(true);
    expect(canAccessInternalTab("technical_support", "diagnostics")).toBe(true);
    expect(canAccessInternalTab("technical_support", "onboarding")).toBe(true);
  });

  it("super_admin: all tabs", () => {
    for (const tab of tabs) {
      expect(canAccessInternalTab("super_admin", tab)).toBe(true);
    }
  });
});

describe("canDisableEnableIntegration", () => {
  it("allows technical_support and super_admin only", () => {
    expect(canDisableEnableIntegration("technical_support")).toBe(true);
    expect(canDisableEnableIntegration("super_admin")).toBe(true);
    expect(canDisableEnableIntegration("account_ops")).toBe(false);
    expect(canDisableEnableIntegration("support_admin")).toBe(false);
  });
});
