import { describe, it, expect } from "vitest";
import { canonicalVerificationRuleKey, hasVerificationRule } from "./canonicalRuleKey";

describe("canonicalVerificationRuleKey", () => {
  it("maps detection types to registry keys", () => {
    expect(canonicalVerificationRuleKey("stripe_failed_payments")).toBe("failed_payments");
    expect(canonicalVerificationRuleKey("hubspot_no_followup_leads")).toBe("no_follow_up");
    expect(hasVerificationRule("salesforce_stale_opportunities")).toBe(true);
    expect(hasVerificationRule("stripe_retry_exhaustion")).toBe(false);
  });
});
