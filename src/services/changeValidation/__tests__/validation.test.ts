import { describe, expect, test } from "vitest";
import { runValidationRules } from "../validationRules";
import { buildResult, getReadinessChecks } from "../validationTypes";

const minimalValidChange = {
  domain: "REVENUE",
  change_type: "CONFIG",
  systems_involved: ["billing"],
  rollout_method: "gradual",
  backfill_required: false,
  customer_impact_expected: false,
  planned_release_at: new Date().toISOString(),
  revenue_surface: "checkout",
  estimated_mrr_affected: 0,
  percent_customer_base_affected: 0,
  rollback_time_estimate_hours: 1,
} as Record<string, unknown>;

describe("runValidationRules", () => {
  test("returns error when change is null", () => {
    const issues = runValidationRules(null);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("CHANGE_NOT_FOUND");
    expect(issues[0].severity).toBe("ERROR");
  });

  test("returns error when systems_involved is empty", () => {
    const issues = runValidationRules({
      ...minimalValidChange,
      systems_involved: [],
    });
    const systemsIssue = issues.find((i) => i.code === "SYSTEMS_REQUIRED");
    expect(systemsIssue).toBeDefined();
    expect(systemsIssue?.severity).toBe("ERROR");
  });

  test("returns error when change_type is missing", () => {
    const issues = runValidationRules({
      ...minimalValidChange,
      change_type: null,
      structured_change_type: null,
    });
    const typeIssue = issues.find((i) => i.code === "CHANGE_TYPE_REQUIRED");
    expect(typeIssue).toBeDefined();
  });

  test("returns error when revenue domain missing revenue_surface", () => {
    const issues = runValidationRules({
      ...minimalValidChange,
      revenue_surface: null,
    });
    const revIssue = issues.find((i) => i.code === "REVENUE_EXPOSURE_REQUIRED" && i.field === "revenue_surface");
    expect(revIssue).toBeDefined();
  });

  test("returns error when estimated_mrr_affected is missing", () => {
    const issues = runValidationRules({
      ...minimalValidChange,
      estimated_mrr_affected: null,
    });
    const mrrIssue = issues.find((i) => i.field === "estimated_mrr_affected");
    expect(mrrIssue).toBeDefined();
  });

  test("returns warning when rollback_time_estimate_hours is missing", () => {
    const issues = runValidationRules({
      ...minimalValidChange,
      rollback_time_estimate_hours: undefined,
    });
    const rollbackIssue = issues.find((i) => i.code === "ROLLBACK_PLAN_RECOMMENDED");
    expect(rollbackIssue).toBeDefined();
    expect(rollbackIssue?.severity).toBe("WARNING");
  });

  test("returns error when rollout_method is missing", () => {
    const issues = runValidationRules({
      ...minimalValidChange,
      rollout_method: null,
    });
    const rolloutIssue = issues.find((i) => i.code === "ROLLOUT_PLAN_REQUIRED" && i.field === "rollout_method");
    expect(rolloutIssue).toBeDefined();
  });

  test("returns error when planned_release_at is missing", () => {
    const issues = runValidationRules({
      ...minimalValidChange,
      planned_release_at: null,
      requested_release_at: null,
    });
    const releaseIssue = issues.find((i) => i.field === "planned_release_at");
    expect(releaseIssue).toBeDefined();
  });

  test("returns error when customer_impact_expected true but no segments", () => {
    const issues = runValidationRules({
      ...minimalValidChange,
      customer_impact_expected: true,
      affected_customer_segments: [],
    });
    const segIssue = issues.find((i) => i.code === "CUSTOMER_IMPACT_REQUIRED" && i.field === "affected_customer_segments");
    expect(segIssue).toBeDefined();
    expect(segIssue?.severity).toBe("ERROR");
  });

  test("passes for minimal valid REVENUE change", () => {
    const issues = runValidationRules(minimalValidChange);
    expect(issues).toHaveLength(0);
  });

  test("passes for change with all optional fields set", () => {
    const issues = runValidationRules({
      ...minimalValidChange,
      customer_impact_expected: false,
      backfill_required: true,
      affected_customer_segments: ["enterprise"],
      rollback_time_estimate_hours: 2,
    });
    expect(issues).toHaveLength(0);
  });
});

describe("buildResult", () => {
  test("ready is true when no errors", () => {
    const result = buildResult([
      { code: "WARN", message: "x", severity: "WARNING" },
    ]);
    expect(result.ready).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
  });

  test("ready is false when any error", () => {
    const result = buildResult([
      { code: "ERR", message: "x", severity: "ERROR" },
      { code: "WARN", message: "y", severity: "WARNING" },
    ]);
    expect(result.ready).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.warnings).toHaveLength(1);
  });
});

describe("getReadinessChecks", () => {
  test("returns pass for rules with no issues", () => {
    const result = buildResult([]);
    const checks = getReadinessChecks(result);
    const systemsCheck = checks.find((c) => c.code === "SYSTEMS_REQUIRED");
    expect(systemsCheck).toBeDefined();
    expect(systemsCheck?.status).toBe("pass");
  });

  test("returns error for rules with ERROR issues", () => {
    const result = buildResult([
      { code: "SYSTEMS_REQUIRED", message: "At least one system", severity: "ERROR", category: "STRUCTURE" },
    ]);
    const checks = getReadinessChecks(result);
    const systemsCheck = checks.find((c) => c.code === "SYSTEMS_REQUIRED");
    expect(systemsCheck?.status).toBe("error");
    expect(systemsCheck?.message).toBe("At least one system");
  });

  test("returns warning for rules with WARNING issues", () => {
    const result = buildResult([
      { code: "ROLLBACK_PLAN_RECOMMENDED", message: "Recommended", severity: "WARNING", category: "ROLLOUT" },
    ]);
    const checks = getReadinessChecks(result);
    const rollbackCheck = checks.find((c) => c.code === "ROLLBACK_PLAN_RECOMMENDED");
    expect(rollbackCheck?.status).toBe("warning");
  });
});
