/**
 * Phase 2 Gap 2 — Policy validation service (§11).
 */
import type { PolicyRule, PolicyConditionGroup } from "../domain";

const SUPPORTED_SCOPES = ["global", "org", "environment", "action", "playbook", "issue_family", "integration", "risk_class"];
const SUPPORTED_DISPOSITIONS = ["ALLOW", "BLOCK", "REQUIRE_APPROVAL"];
const SUPPORTED_FIELDS = ["actionKey", "playbookKey", "impactAmount", "riskLevel", "severity", "issueFamily", "provider"];
const SUPPORTED_OPERATORS = ["EQ", "NEQ", "GT", "GTE", "LT", "LTE", "IN", "NOT_IN", "EXISTS", "NOT_EXISTS"];
const SUPPORTED_EFFECTS = ["ALLOW", "BLOCK", "REQUIRE_APPROVAL", "LIMIT_AUTONOMY_MODE"];

export type ValidationError = {
  field: string;
  code: string;
  message: string;
};

export type ValidationWarning = {
  code: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
};

export type PolicyDraft = {
  displayName?: string;
  policyKey?: string;
  scope?: string;
  scopeRef?: string | null;
  defaultDisposition?: string;
  rules?: PolicyRule[];
};

export function validatePolicyDraft(draft: PolicyDraft): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!draft.displayName?.trim()) {
    errors.push({ field: "displayName", code: "required", message: "Display name is required." });
  }

  if (draft.scope && !SUPPORTED_SCOPES.includes(draft.scope)) {
    errors.push({ field: "scope", code: "unsupported_scope", message: `Scope '${draft.scope}' is not supported.` });
  }

  if (draft.defaultDisposition && !SUPPORTED_DISPOSITIONS.includes(draft.defaultDisposition)) {
    errors.push({ field: "defaultDisposition", code: "unsupported_disposition", message: `Disposition '${draft.defaultDisposition}' is not supported.` });
  }

  const rules = draft.rules ?? [];
  const ruleKeys = new Set<string>();
  let hasApprovalRule = false;
  let hasBlockRule = false;

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i]!;
    const prefix = `rules[${i}]`;

    if (!rule.ruleKey?.trim()) {
      errors.push({ field: `${prefix}.ruleKey`, code: "required", message: "Rule key is required." });
    } else if (ruleKeys.has(rule.ruleKey)) {
      errors.push({ field: `${prefix}.ruleKey`, code: "duplicate_rule_key", message: `Duplicate rule key '${rule.ruleKey}'.` });
    } else {
      ruleKeys.add(rule.ruleKey);
    }

    if (rule.effect?.type === "BLOCK") hasBlockRule = true;
    if (rule.effect?.type === "REQUIRE_APPROVAL") hasApprovalRule = true;

    if (rule.effect && !SUPPORTED_EFFECTS.includes(rule.effect.type)) {
      errors.push({ field: `${prefix}.effect.type`, code: "unsupported_effect", message: `Effect '${rule.effect.type}' is not supported.` });
    }

    if (rule.effect?.type === "REQUIRE_APPROVAL") {
      const eff = rule.effect as { approverRoles?: string[]; approvalCount?: number };
      if (!eff.approverRoles?.length) {
        errors.push({ field: `${prefix}.effect.approverRoles`, code: "required", message: "Approver roles required for REQUIRE_APPROVAL." });
      }
      if (eff.approvalCount != null && (eff.approvalCount < 1 || eff.approvalCount > 10)) {
        errors.push({ field: `${prefix}.effect.approvalCount`, code: "invalid", message: "Approval count must be 1–10." });
      }
    }

    if (rule.match) {
      validateConditionGroup(rule.match, `${prefix}.match`, errors);
    }
  }

  if (hasApprovalRule && hasBlockRule) {
    warnings.push({ code: "conflicting_semantics", message: "Policy contains both approval and block rules." });
  }

  if (rules.length === 0 && draft.defaultDisposition === "ALLOW") {
    warnings.push({ code: "broad_allow", message: "No rules with ALLOW default may be overly permissive." });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateConditionGroup(group: PolicyConditionGroup, path: string, errors: ValidationError[]): void {
  const conditions = group.conditions ?? [];
  for (let i = 0; i < conditions.length; i++) {
    const c = conditions[i]!;
    if ("operator" in c && "conditions" in c) {
      validateConditionGroup(c as PolicyConditionGroup, `${path}.conditions[${i}]`, errors);
    } else {
      const cond = c as { field?: string; operator?: string; value?: unknown };
      if (cond.field && !SUPPORTED_FIELDS.includes(cond.field)) {
        errors.push({ field: `${path}.conditions[${i}].field`, code: "unsupported_field", message: `Field '${cond.field}' is not allowed.` });
      }
      if (cond.operator && !SUPPORTED_OPERATORS.includes(cond.operator)) {
        errors.push({ field: `${path}.conditions[${i}].operator`, code: "unsupported_operator", message: `Operator '${cond.operator}' is not supported.` });
      }
    }
  }
}
