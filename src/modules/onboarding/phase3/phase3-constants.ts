export const PHASE3_STEPS = [
  "expand_coverage",
  "invite_more_teams",
  "executive_visibility",
  "prove_value",
  "build_habit",
] as const;

export type Phase3StepKey = (typeof PHASE3_STEPS)[number];

export const DEPARTMENTS = [
  "Sales",
  "RevOps",
  "Finance",
  "Operations",
  "IT",
  "Customer Success",
  "Leadership",
  "Other",
] as const;

export type DepartmentKey = (typeof DEPARTMENTS)[number];

export const EXEC_SUMMARY_METRICS = [
  "revenue_at_risk",
  "prevented_incidents",
  "approval_bottlenecks",
  "forecast_changes",
  "time_saved",
  "value_created",
] as const;

export type ExecutiveSummaryMetricKey = (typeof EXEC_SUMMARY_METRICS)[number];

export const PHASE3_TERMINAL = new Set(["COMPLETED", "SKIPPED"]);
