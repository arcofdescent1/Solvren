/**
 * Phase 3 — Policy disposition (final decision).
 */
export type PolicyDisposition = "ALLOW" | "BLOCK" | "REQUIRE_APPROVAL";

export const POLICY_DISPOSITIONS: PolicyDisposition[] = ["ALLOW", "BLOCK", "REQUIRE_APPROVAL"];
