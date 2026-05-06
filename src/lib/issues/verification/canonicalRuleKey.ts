/**
 * Map Value Engine detection_type → Phase 4 verification registry key.
 */
const TO_RULE: Record<string, string> = {
  stripe_failed_payments: "failed_payments",
  stripe_high_refund_rate: "high_refund_rate",
  hubspot_no_followup_leads: "no_follow_up",
  hubspot_stalled_deals: "stalled_deals",
  salesforce_stale_opportunities: "stale_opportunities",
};

export function canonicalVerificationRuleKey(detectionType: string | null | undefined): string | null {
  if (!detectionType) return null;
  if (TO_RULE[detectionType]) return TO_RULE[detectionType];
  const stripped = detectionType.replace(/^(stripe|hubspot|salesforce)_/i, "");
  return stripped || null;
}

export const VERIFICATION_RULE_KEYS = new Set([
  "failed_payments",
  "high_refund_rate",
  "no_follow_up",
  "stalled_deals",
  "stale_opportunities",
]);

export function hasVerificationRule(detectionType: string | null | undefined): boolean {
  const k = canonicalVerificationRuleKey(detectionType);
  return k != null && VERIFICATION_RULE_KEYS.has(k);
}
