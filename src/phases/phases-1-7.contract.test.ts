/**
 * Roadmap phases 1–7 — automated contract checks.
 *
 * These tests pin stable behavior at each phase boundary. They are not exhaustive feature tests;
 * module-specific suites live alongside the code. If a test here fails, a phase contract likely moved.
 *
 * | Phase | Theme (this repo) | Primary hook |
 * |-------|-------------------|--------------|
 * | 1 | Integration platform, scopes, change intake | scope registry, validateChangeIntake |
 * | 2 | Simulation engine | scoreToBand |
 * | 3 | Domains / governance intake | validateChangeIntake REVENUE path |
 * | 4 | Inbound reliability | deriveIntegrationStatus, classifyInboundError |
 * | 5 | Impact + governance context | baseline risk, policyEnvironmentToGovernance |
 * | 6 | Learning / calibration | proposeImpactThresholdFromFacts |
 * | 7 | Org purge | retention evaluator, purge table inventory |
 */
import { describe, expect, it } from "vitest";
import { INTEGRATION_SCOPE_REGISTRY } from "@/lib/integrations/scopeRegistry";
import { validateChangeIntake } from "@/services/changes/validateChangeIntake";
import { scoreToBand, SimulationConfidenceBand } from "@/modules/simulation/domain/simulation-confidence-band";
import { deriveIntegrationStatus } from "@/modules/integrations/health/healthEvaluator";
import { classifyInboundError } from "@/modules/integrations/reliability/services/inbound-error-classifier";
import { calculateBaselineRisk } from "@/services/revenueImpact/calculateBaselineRisk";
import type { RevenueImpactInput } from "@/services/revenueImpact/revenueImpactTypes";
import { policyEnvironmentToGovernance } from "@/modules/governance/context-builders";
import type { GovernanceDecisionFact } from "@/modules/learning/data/governance-decision-facts.service";
import { proposeImpactThresholdFromFacts } from "@/modules/learning/calibration/threshold-tuning.service";
import { evaluateOrgPurgeRetention } from "@/modules/org-purge/org-purge-retention-evaluator.service";
import { ORG_PURGE_TABLE_SPECS } from "@/modules/org-purge/org-purge-tables.generated";

function minimalRevenueImpactInput(): RevenueImpactInput {
  return {
    inputHash: "contract-test",
    change: {
      id: "c-contract",
      orgId: "o-contract",
      title: "Contract test",
      description: "Phase 5 smoke",
      changeType: "Billing Logic",
      domain: "Finance",
      systems: ["Stripe"],
      rolloutMethod: "Immediate",
      rollbackPlan: "",
      monitoringPlan: "",
      customerImpact: true,
      revenueImpactArea: ["BILLING"],
      revenueExposureEstimate: 10000,
      backfillRequired: true,
      approvers: [],
      evidenceItems: [],
      authorId: "u1",
      status: "READY",
      createdAt: new Date().toISOString(),
      submittedAt: null,
    },
    organization: {
      orgName: "Contract Org",
      orgSettings: {},
      approvalMappings: [],
      domainSettings: {},
      systemCatalog: [],
    },
    historical: {
      similarChangeCount: 3,
      incidentCount: 1,
      incidentRate: 0.2,
      topSignals: [],
    },
  };
}

function sampleFact(impact: number, disposition: string): GovernanceDecisionFact {
  return {
    trace_id: "00000000-0000-4000-8000-000000000001",
    org_id: "00000000-0000-4000-8000-000000000002",
    decision_timestamp: new Date().toISOString(),
    resource_type: null,
    resource_id: null,
    action_key: "contract.test",
    disposition,
    approval_required: false,
    impact_amount: impact,
    confidence: null,
  };
}

describe("Phase 1 — integration platform & scopes", () => {
  it("registers OAuth scope profiles for major providers", () => {
    const keys = new Set(INTEGRATION_SCOPE_REGISTRY.map((p) => p.provider));
    expect(keys.has("slack")).toBe(true);
    expect(keys.has("jira")).toBe(true);
  });
});

describe("Phase 2 — simulation", () => {
  it("keeps confidence band mapping stable", () => {
    expect(scoreToBand(91)).toBe(SimulationConfidenceBand.VERY_HIGH);
  });
});

describe("Phase 3 — change intake (domain / policy path)", () => {
  it("accepts a minimal valid REVENUE intake payload", () => {
    const res = validateChangeIntake({
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
    } as Record<string, unknown>);
    expect(res.ok).toBe(true);
  });
});

describe("Phase 4 — integration health & inbound", () => {
  it("derives disconnected status when disconnected_at is set", () => {
    const status = deriveIntegrationStatus({
      status: "x",
      disconnectedAt: new Date().toISOString(),
      authExpired: false,
      installComplete: true,
      criticalError: false,
      syncRunning: false,
      actionConfigValid: true,
      requiredScopesMissing: false,
      webhookOrConfigIncomplete: false,
      freshnessOrHealthFailing: false,
    });
    expect(status).toBe("disconnected");
  });

  it("classifies inbound failures deterministically", () => {
    expect(classifyInboundError("invalid signature on webhook")).toBe("SIGNATURE_INVALID");
  });
});

describe("Phase 5 — impact & governance context", () => {
  it("computes a baseline risk level for a billing-like change", () => {
    const baseline = calculateBaselineRisk(minimalRevenueImpactInput());
    expect(baseline.baselineRiskScore).toBeGreaterThan(0);
    expect(baseline.baselineRiskLevel).toBeTruthy();
  });

  it("maps policy environments for governance evaluation", () => {
    expect(policyEnvironmentToGovernance("production")).toBe("prod");
    expect(policyEnvironmentToGovernance("sandbox")).toBe("dev");
  });
});

describe("Phase 6 — learning / calibration", () => {
  it("returns null when calibration has insufficient ALLOW samples", () => {
    const facts = [sampleFact(100, "ALLOW"), sampleFact(200, "ALLOW")];
    expect(proposeImpactThresholdFromFacts(facts, { min: 0, max: 1e9 })).toBeNull();
  });
});

describe("Phase 7 — org purge", () => {
  it("blocks purge when legal hold is asserted", () => {
    const r = evaluateOrgPurgeRetention({ legalHoldActive: true });
    expect(r.blocked).toBe(true);
  });

  it("keeps a generated org-scoped table inventory for planner/verifier", () => {
    expect(ORG_PURGE_TABLE_SPECS.length).toBeGreaterThan(100);
    const orgIdCols = new Set(ORG_PURGE_TABLE_SPECS.map((s) => s.orgColumn));
    expect(orgIdCols.has("org_id")).toBe(true);
  });
});
