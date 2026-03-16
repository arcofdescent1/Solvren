/**
 * Validation rules for the change validation engine.
 * Rules are organized by category: STRUCTURE, BUSINESS, ROLLOUT, GOVERNANCE, EVIDENCE.
 */

import type { ValidationIssue } from "./validationTypes";

export type ChangeForValidation = Record<string, unknown> | null | undefined;

const REQUIRED_SYSTEMS_MIN = 1;

/**
 * Run all validation rules and return collected issues.
 * Optimized: expects change object; caller fetches once.
 */
export function runValidationRules(change: ChangeForValidation): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!change) {
    issues.push({
      code: "CHANGE_NOT_FOUND",
      message: "Change not found",
      severity: "ERROR",
      category: "STRUCTURE",
    });
    return issues;
  }

  // --- STRUCTURE ---

  const systems = change.systems_involved as unknown;
  if (!Array.isArray(systems) || systems.length < REQUIRED_SYSTEMS_MIN) {
    issues.push({
      code: "SYSTEMS_REQUIRED",
      message: "At least one system must be selected",
      severity: "ERROR",
      category: "STRUCTURE",
      field: "systems_involved",
    });
  }

  const changeType = change.change_type ?? change.structured_change_type;
  if (!changeType || String(changeType).trim() === "") {
    issues.push({
      code: "CHANGE_TYPE_REQUIRED",
      message: "Change type must be selected",
      severity: "ERROR",
      category: "STRUCTURE",
      field: "change_type",
    });
  }

  // --- BUSINESS ---

  const domain = (change.domain ?? "REVENUE") as string;
  if (domain === "REVENUE") {
    if (!change.revenue_surface || String(change.revenue_surface).trim() === "") {
      issues.push({
        code: "REVENUE_EXPOSURE_REQUIRED",
        message: "Revenue surface is required for revenue domain",
        severity: "ERROR",
        category: "BUSINESS",
        field: "revenue_surface",
      });
    }
    const mrr = change.estimated_mrr_affected;
    if (mrr == null || Number(mrr) < 0) {
      issues.push({
        code: "REVENUE_EXPOSURE_REQUIRED",
        message: "Estimated MRR affected is required",
        severity: "ERROR",
        category: "BUSINESS",
        field: "estimated_mrr_affected",
      });
    }
    const pct = change.percent_customer_base_affected;
    if (pct == null || Number(pct) < 0) {
      issues.push({
        code: "REVENUE_EXPOSURE_REQUIRED",
        message: "Percent customer base affected is required",
        severity: "ERROR",
        category: "BUSINESS",
        field: "percent_customer_base_affected",
      });
    }
  }

  if (typeof change.customer_impact_expected !== "boolean") {
    issues.push({
      code: "CUSTOMER_IMPACT_REQUIRED",
      message: "Customer impact expected must be defined",
      severity: "WARNING",
      category: "BUSINESS",
      field: "customer_impact_expected",
    });
  } else if (change.customer_impact_expected === true) {
    const segments = change.affected_customer_segments as unknown;
    if (!Array.isArray(segments) || segments.length === 0) {
      issues.push({
        code: "CUSTOMER_IMPACT_REQUIRED",
        message: "Affected customer segments required when customer impact expected",
        severity: "ERROR",
        category: "BUSINESS",
        field: "affected_customer_segments",
      });
    }
  }

  if (typeof change.backfill_required !== "boolean") {
    issues.push({
      code: "BACKFILL_REQUIRED",
      message: "Backfill required must be defined",
      severity: "WARNING",
      category: "BUSINESS",
      field: "backfill_required",
    });
  }

  // --- ROLLOUT ---

  const rollout = change.rollout_method;
  if (!rollout || String(rollout).trim() === "") {
    issues.push({
      code: "ROLLOUT_PLAN_REQUIRED",
      message: "Rollout method is required",
      severity: "ERROR",
      category: "ROLLOUT",
      field: "rollout_method",
    });
  }

  const plannedRelease = change.planned_release_at ?? change.requested_release_at;
  if (!plannedRelease) {
    issues.push({
      code: "ROLLOUT_PLAN_REQUIRED",
      message: "Planned release date is required",
      severity: "ERROR",
      category: "ROLLOUT",
      field: "planned_release_at",
    });
  }

  const rollbackHours = change.rollback_time_estimate_hours;
  if (rollbackHours == null || Number(rollbackHours) < 0) {
    issues.push({
      code: "ROLLBACK_PLAN_RECOMMENDED",
      message: "Rollback time estimate is recommended",
      severity: "WARNING",
      category: "ROLLOUT",
      field: "rollback_time_estimate_hours",
    });
  }

  return issues;
}
