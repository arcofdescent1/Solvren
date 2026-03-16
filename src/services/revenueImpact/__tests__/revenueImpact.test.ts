import { describe, expect, test } from "vitest";
import { calculateBaselineRisk } from "../calculateBaselineRisk";
import { buildRevenueImpactInputHash } from "../buildRevenueImpactInput";
import { fallbackRevenueImpactReport } from "../fallbackRevenueImpactReport";
import { revenueImpactReportSchema } from "../revenueImpactSchema";
import type { RevenueImpactInput } from "../revenueImpactTypes";

function baseInput(partial?: Partial<RevenueImpactInput>): RevenueImpactInput {
  return {
    inputHash: "x",
    change: {
      id: "c1",
      orgId: "o1",
      title: "Billing change",
      description: "Update billing flow",
      changeType: "Billing Logic",
      domain: "Finance",
      systems: ["Stripe", "NetSuite"],
      rolloutMethod: "Immediate",
      rollbackPlan: "",
      monitoringPlan: "",
      customerImpact: true,
      revenueImpactArea: ["BILLING"],
      revenueExposureEstimate: 10000,
      backfillRequired: true,
      approvers: ["RevOps"],
      evidenceItems: [{ label: "Runbook", kind: "DOC", status: "REQUIRED" }],
      authorId: "u1",
      status: "READY",
      createdAt: new Date().toISOString(),
      submittedAt: null,
    },
    organization: {
      orgName: "Acme",
      orgSettings: {},
      approvalMappings: [],
      domainSettings: {},
      systemCatalog: [],
    },
    historical: {
      similarChangeCount: 5,
      incidentCount: 2,
      incidentRate: 0.4,
      topSignals: [],
    },
    ...partial,
  };
}

describe("calculateBaselineRisk", () => {
  test("billing logic + Stripe + no rollback is high", () => {
    const baseline = calculateBaselineRisk(baseInput());
    expect(baseline.baselineRiskScore).toBeGreaterThanOrEqual(50);
    expect(["HIGH", "CRITICAL"]).toContain(baseline.baselineRiskLevel);
  });

  test("reporting-like gradual rollout with monitoring trends lower", () => {
    const baseline = calculateBaselineRisk(
      baseInput({
        change: {
          ...baseInput().change,
          changeType: "Reporting",
          systems: ["Looker"],
          rolloutMethod: "Gradual",
          monitoringPlan: "Dashboards and alerts configured",
          rollbackPlan: "Rollback script tested in staging",
          backfillRequired: false,
          revenueExposureEstimate: 1000,
        },
        historical: {
          similarChangeCount: 12,
          incidentCount: 0,
          incidentRate: 0,
          topSignals: [],
        },
      })
    );
    expect(baseline.baselineRiskScore).toBeLessThan(60);
  });

  test("same input gives stable score", () => {
    const a = calculateBaselineRisk(baseInput());
    const b = calculateBaselineRisk(baseInput());
    expect(a.baselineRiskScore).toBe(b.baselineRiskScore);
    expect(a.baselineRiskLevel).toBe(b.baselineRiskLevel);
  });
});

describe("input hash", () => {
  test("hash stable for same material input", () => {
    const h1 = buildRevenueImpactInputHash({
      title: "A",
      description: "B",
      changeType: "Pricing",
      domain: "Revenue",
      systems: ["Stripe"],
      rolloutMethod: "Immediate",
      rollbackPlan: "x",
      monitoringPlan: "y",
      revenueImpactArea: ["BILLING"],
      revenueExposureEstimate: 100,
      backfillRequired: false,
      evidenceStatuses: [{ label: "l", status: "REQUIRED", kind: "DOC" }],
      approvers: ["RevOps"],
      linkedIncidents: [],
    });
    const h2 = buildRevenueImpactInputHash({
      title: "A",
      description: "B",
      changeType: "Pricing",
      domain: "Revenue",
      systems: ["Stripe"],
      rolloutMethod: "Immediate",
      rollbackPlan: "x",
      monitoringPlan: "y",
      revenueImpactArea: ["BILLING"],
      revenueExposureEstimate: 100,
      backfillRequired: false,
      evidenceStatuses: [{ label: "l", status: "REQUIRED", kind: "DOC" }],
      approvers: ["RevOps"],
      linkedIncidents: [],
    });
    expect(h1).toBe(h2);
  });

  test("hash changes when material fields change", () => {
    const h1 = buildRevenueImpactInputHash({
      title: "A",
      description: "B",
      changeType: "Pricing",
      domain: "Revenue",
      systems: ["Stripe"],
      rolloutMethod: "Immediate",
      rollbackPlan: "x",
      monitoringPlan: "y",
      revenueImpactArea: ["BILLING"],
      revenueExposureEstimate: 100,
      backfillRequired: false,
      evidenceStatuses: [{ label: "l", status: "REQUIRED", kind: "DOC" }],
      approvers: ["RevOps"],
      linkedIncidents: [],
    });
    const h2 = buildRevenueImpactInputHash({
      title: "A2",
      description: "B",
      changeType: "Pricing",
      domain: "Revenue",
      systems: ["Stripe"],
      rolloutMethod: "Immediate",
      rollbackPlan: "x",
      monitoringPlan: "y",
      revenueImpactArea: ["BILLING"],
      revenueExposureEstimate: 100,
      backfillRequired: false,
      evidenceStatuses: [{ label: "l", status: "REQUIRED", kind: "DOC" }],
      approvers: ["RevOps"],
      linkedIncidents: [],
    });
    expect(h1).not.toBe(h2);
  });
});

describe("fallback report", () => {
  test("creates schema-valid report when AI is unavailable", () => {
    const input = baseInput();
    const baseline = calculateBaselineRisk(input);
    const report = fallbackRevenueImpactReport({ input, baseline });
    const parsed = revenueImpactReportSchema.safeParse(report);
    expect(parsed.success).toBe(true);
  });
});
