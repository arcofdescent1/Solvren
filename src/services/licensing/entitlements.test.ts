import { describe, expect, it } from "vitest";
import { buildLicenseEntitlements, hasCapability, normalizeLicenseTier, normalizeProtectedRevenueBand } from ".";

describe("enterprise licensing model", () => {
  it("normalizes legacy and marketing tier names to canonical license tiers", () => {
    expect(normalizeLicenseTier("PRO")).toBe("TEAM");
    expect(normalizeLicenseTier("Starter")).toBe("TEAM");
    expect(normalizeLicenseTier("Growth")).toBe("BUSINESS");
    expect(normalizeLicenseTier("enterprise")).toBe("ENTERPRISE");
    expect(normalizeLicenseTier("strategic")).toBe("STRATEGIC_ENTERPRISE");
  });

  it("supports protected revenue bands as the enterprise value metric", () => {
    expect(normalizeProtectedRevenueBand("$25M-$100M")).toBe("25M_100M");
    expect(normalizeProtectedRevenueBand("over_1b")).toBe("1B_PLUS");
    expect(normalizeProtectedRevenueBand(null)).toBe("UNSET");
  });

  it("keeps free and inactive licenses from unlocking capabilities", () => {
    expect(hasCapability({ tier: "FREE", status: "ACTIVE" }, "weekly_digest")).toBe(false);
    expect(hasCapability({ tier: "ENTERPRISE", status: "CANCELED" }, "sso")).toBe(false);
  });

  it("grants Team communication capabilities without enterprise controls", () => {
    const entitlements = buildLicenseEntitlements({ tier: "TEAM", status: "ACTIVE" });
    expect(entitlements.capabilities.slack_notifications).toBe(true);
    expect(entitlements.capabilities.weekly_digest).toBe(true);
    expect(entitlements.capabilities.sso).toBe(false);
    expect(entitlements.unlimitedExecutiveAccess).toBe(false);
  });

  it("grants Business proof workflows and broad executive visibility", () => {
    const entitlements = buildLicenseEntitlements({ tier: "BUSINESS", status: "ACTIVE" });
    expect(entitlements.capabilities.executive_proof_packets).toBe(true);
    expect(entitlements.capabilities.escalations).toBe(true);
    expect(entitlements.unlimitedExecutiveAccess).toBe(true);
  });

  it("grants Enterprise trust and rollout controls", () => {
    const entitlements = buildLicenseEntitlements({
      tier: "ENTERPRISE",
      status: "ACTIVE",
      protectedRevenueBand: "100M_250M",
    });
    expect(entitlements.capabilities.sso).toBe(true);
    expect(entitlements.capabilities.customer_controlled_support_access).toBe(true);
    expect(entitlements.capabilities.board_ready_exports).toBe(true);
    expect(entitlements.implementationMode).toBe("GUIDED");
    expect(entitlements.protectedRevenueBand).toBe("100M_250M");
  });

  it("supports strategic enterprise governance", () => {
    const entitlements = buildLicenseEntitlements({ tier: "STRATEGIC_ENTERPRISE", status: "ACTIVE" });
    expect(entitlements.capabilities.strategic_governance).toBe(true);
    expect(entitlements.implementationMode).toBe("WHITE_GLOVE");
  });
});
