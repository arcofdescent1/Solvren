/**
 * Phase 3 — Policy condition DSL (§8.3, 8.4).
 */
export type PolicyConditionOperator =
  | "EQ"
  | "NEQ"
  | "GT"
  | "GTE"
  | "LT"
  | "LTE"
  | "IN"
  | "NOT_IN"
  | "EXISTS"
  | "NOT_EXISTS";

export type PolicyCondition = {
  field: string;
  operator: PolicyConditionOperator;
  value?: string | number | boolean | string[] | number[];
};

export type PolicyConditionGroup = {
  operator: "AND" | "OR";
  conditions: Array<PolicyCondition | PolicyConditionGroup>;
};
