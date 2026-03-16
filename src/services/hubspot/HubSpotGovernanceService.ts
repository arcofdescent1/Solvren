/**
 * HubSpot Governance Service — Phase 6.
 * Evaluates governance rules against HubSpot changes (e.g., "If deal amount increases > $100k, require Finance Approval").
 * Used by HubSpotChangeProcessor to determine approval requirements.
 */
export type HubSpotGovernanceRule = {
  id: string;
  objectType: string;
  property?: string;
  condition: "percent_change" | "absolute_change" | "threshold";
  threshold?: number;
  requiredApproval?: string;
};

export function evaluateHubSpotGovernanceRules(
  _objectType: string,
  _property: string,
  _oldValue: unknown,
  _newValue: unknown,
  _rules: HubSpotGovernanceRule[]
): HubSpotGovernanceRule[] {
  // Stub: return rules that match the change
  return [];
}
