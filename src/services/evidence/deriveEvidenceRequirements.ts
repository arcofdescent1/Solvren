import type { EvidenceRequirement } from "./types";

export type ChangeContext = Record<string, unknown>;

const LABELS: Record<string, string> = {
  TEST_PLAN: "Test Plan",
  ROLLBACK: "Rollback Plan",
  RUNBOOK: "Runbook / Release Plan",
  DASHBOARD: "Validation Dashboard",
  COMMS_PLAN: "Customer Comms Plan",
  PR: "PR / Change Diff",
  MONITORING_PLAN: "Monitoring Plan",
  REVENUE_VALIDATION: "Revenue Validation Plan",
  DATA_BACKFILL_PLAN: "Data Backfill Plan",
  OTHER: "Other",
};

function label(kind: string): string {
  return LABELS[kind] ?? kind.replace(/_/g, " ");
}

export function deriveEvidenceRequirements(
  change: ChangeContext
): EvidenceRequirement[] {
  const out: EvidenceRequirement[] = [];
  const added = new Set<string>();

  const add = (kind: string, sev: "REQUIRED" | "RECOMMENDED") => {
    if (added.has(kind)) return;
    added.add(kind);
    out.push({ kind: kind as EvidenceRequirement["kind"], label: label(kind), severity: sev });
  };

  const ct = String(change.structured_change_type ?? change.change_type ?? "").toUpperCase();
  const backfill = Boolean(change.backfill_required);
  const domain = String(change.domain ?? "REVENUE");
  const rollout = String(change.rollout_method ?? "").toUpperCase();
  const customerImpact = Boolean(change.customer_impact_expected);

  if (ct.includes("PRICING") || ct === "PROMOTION_DISCOUNT_CHANGE") {
    add("REVENUE_VALIDATION", "REQUIRED");
    add("ROLLBACK", "REQUIRED");
    add("TEST_PLAN", "REQUIRED");
    add("COMMS_PLAN", "RECOMMENDED");
  }
  if (ct.includes("BILLING") || ct.includes("PAYMENT") || ct.includes("TAX")) {
    add("TEST_PLAN", "REQUIRED");
    add("ROLLBACK", "REQUIRED");
    add("MONITORING_PLAN", "REQUIRED");
    if (backfill) add("DATA_BACKFILL_PLAN", "REQUIRED");
  }
  if (ct.includes("REPORTING")) {
    add("REVENUE_VALIDATION", "REQUIRED");
    add("COMMS_PLAN", "RECOMMENDED");
  }
  if (ct.includes("SUBSCRIPTION") || ct.includes("ENTITLEMENTS")) {
    add("TEST_PLAN", "REQUIRED");
    add("ROLLBACK", "REQUIRED");
    add("RUNBOOK", "RECOMMENDED");
  }
  if (ct.includes("REVENUE_RECOGNITION")) {
    add("REVENUE_VALIDATION", "REQUIRED");
    add("TEST_PLAN", "REQUIRED");
    add("ROLLBACK", "REQUIRED");
    if (backfill) add("DATA_BACKFILL_PLAN", "REQUIRED");
  }
  if (ct.includes("DATA_BACKFILL")) {
    add("DATA_BACKFILL_PLAN", "REQUIRED");
    add("ROLLBACK", "REQUIRED");
    add("RUNBOOK", "RECOMMENDED");
  }
  if (ct.includes("INTEGRATION")) {
    add("TEST_PLAN", "REQUIRED");
    add("ROLLBACK", "REQUIRED");
    add("RUNBOOK", "RECOMMENDED");
    add("MONITORING_PLAN", "RECOMMENDED");
  }
  if (customerImpact) add("COMMS_PLAN", "RECOMMENDED");
  if (rollout === "GRADUAL") add("MONITORING_PLAN", "RECOMMENDED");

  if (domain === "REVENUE" && out.length === 0) {
    add("PR", "REQUIRED");
    add("TEST_PLAN", "RECOMMENDED");
    add("ROLLBACK", "RECOMMENDED");
  }
  if (out.length === 0) {
    add("TEST_PLAN", "REQUIRED");
    add("ROLLBACK", "RECOMMENDED");
  }

  return out;
}
