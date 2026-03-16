/**
 * Salesforce Governance Service — Phase 6.
 * Evaluates governance rules against CRM changes (e.g., "If Amount changes > 10%, require Revenue Approval").
 * Used by SalesforceChangeProcessor to determine approval requirements.
 */
export type GovernanceRule = {
  id: string;
  objectType: string;
  field?: string;
  condition: "percent_change" | "absolute_change" | "threshold";
  threshold?: number;
  requiredApproval?: string;
};

export function evaluateGovernanceRules(
  _objectType: string,
  _field: string,
  _oldValue: unknown,
  _newValue: unknown,
  _rules: GovernanceRule[]
): GovernanceRule[] {
  // Stub: return rules that match the change
  return [];
}
