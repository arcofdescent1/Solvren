/**
 * Central validation types for the change validation engine.
 * Used by submission readiness, UI, API, and workflow.
 */

export type ValidationSeverity = "ERROR" | "WARNING";

export type ValidationCategory =
  | "STRUCTURE"
  | "BUSINESS"
  | "ROLLOUT"
  | "GOVERNANCE"
  | "EVIDENCE";

export type ValidationIssue = {
  code: string;
  message: string;
  severity: ValidationSeverity;
  category?: ValidationCategory;
  field?: string;
};

export type ValidationResult = {
  ready: boolean;
  issues: ValidationIssue[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
};

/**
 * ready = no ERROR issues. Warnings do not block submission.
 */
export function buildResult(issues: ValidationIssue[]): ValidationResult {
  const errors = issues.filter((i) => i.severity === "ERROR");
  const warnings = issues.filter((i) => i.severity === "WARNING");
  return {
    ready: errors.length === 0,
    issues,
    errors,
    warnings,
  };
}

/**
 * Rule display metadata for UI readiness panel.
 * Order and labels for ✓ / ✗ / ⚠ display.
 */
export type ReadinessCheckItem = {
  code: string;
  label: string;
  status: "pass" | "error" | "warning";
  message?: string;
};

const RULE_LABELS: Record<string, string> = {
  SYSTEMS_REQUIRED: "Systems defined",
  CHANGE_TYPE_REQUIRED: "Change type selected",
  REVENUE_EXPOSURE_REQUIRED: "Revenue exposure required",
  CUSTOMER_IMPACT_REQUIRED: "Customer impact defined",
  BACKFILL_REQUIRED: "Backfill required defined",
  ROLLOUT_PLAN_REQUIRED: "Rollout plan required",
  ROLLBACK_PLAN_RECOMMENDED: "Rollback plan recommended",
  ASSESSMENT_REQUIRED: "Risk assessment computed",
  CHANGE_NOT_FOUND: "Change found",
  CHANGE_FETCH_ERROR: "Change loaded",
};

/** Rules displayed in readiness panel, in order. */
const DISPLAY_RULE_ORDER = [
  "SYSTEMS_REQUIRED",
  "CHANGE_TYPE_REQUIRED",
  "REVENUE_EXPOSURE_REQUIRED",
  "CUSTOMER_IMPACT_REQUIRED",
  "BACKFILL_REQUIRED",
  "ROLLOUT_PLAN_REQUIRED",
  "ROLLBACK_PLAN_RECOMMENDED",
  "ASSESSMENT_REQUIRED",
] as const;

/** Build readiness checks for UI display from validation result. */
export function getReadinessChecks(result: ValidationResult): ReadinessCheckItem[] {
  const byCode = new Map<string, ValidationIssue>();
  for (const i of result.issues) {
    if (!byCode.has(i.code)) byCode.set(i.code, i);
  }
  return DISPLAY_RULE_ORDER.map((code) => {
    const issue = byCode.get(code);
    const label = RULE_LABELS[code] ?? code;
    if (!issue)
      return { code, label, status: "pass" as const };
    return {
      code,
      label,
      status: (issue.severity === "ERROR" ? "error" : "warning") as "error" | "warning",
      message: issue.message,
    };
  });
}
