import { FAILURE_MODE_LIBRARY } from "./failureModeLibrary";
import { DEFAULT_APPROVAL_ROLES, SAFEGUARD_LIBRARY } from "./safeguardLibrary";
import type { BaselineRisk, RevenueImpactInput, RevenueImpactReport } from "./revenueImpactTypes";

function exposureBandFromEstimate(estimate: number | null) {
  if (estimate == null || estimate <= 0) return "NONE" as const;
  if (estimate < 10000) return "LOW" as const;
  if (estimate < 50000) return "MEDIUM" as const;
  if (estimate < 250000) return "HIGH" as const;
  return "SEVERE" as const;
}

function customerImpactLevel(value: boolean | null) {
  return value ? ("MODERATE" as const) : ("LOW" as const);
}

function complexityFromSystems(systems: string[]) {
  if (systems.length >= 5) return "HIGH" as const;
  if (systems.length >= 3) return "MEDIUM" as const;
  return "LOW" as const;
}

function pickFailureModeKey(input: RevenueImpactInput): keyof typeof FAILURE_MODE_LIBRARY {
  const t = String(input.change.changeType ?? "").toLowerCase();
  if (t.includes("pricing")) return "PRICING";
  if (t.includes("billing")) return "BILLING_LOGIC";
  if (t.includes("revenue recognition") || t.includes("revrec")) return "REVENUE_RECOGNITION";
  if (t.includes("lead")) return "LEAD_ROUTING";
  return "DEFAULT";
}

export function fallbackRevenueImpactReport(args: {
  input: RevenueImpactInput;
  baseline: BaselineRisk;
}): RevenueImpactReport {
  const { input, baseline } = args;
  const modeKey = pickFailureModeKey(input);
  const failureModes = FAILURE_MODE_LIBRARY[modeKey] ?? FAILURE_MODE_LIBRARY.DEFAULT;
  const requiredSafeguards = [
    ...SAFEGUARD_LIBRARY.BASELINE.filter((s) => s.required),
    ...(modeKey === "BILLING_LOGIC" ? SAFEGUARD_LIBRARY.BILLING.filter((s) => s.required) : []),
    ...(input.change.backfillRequired ? SAFEGUARD_LIBRARY.BACKFILL.filter((s) => s.required) : []),
  ];
  const recommendedSafeguards = [
    ...SAFEGUARD_LIBRARY.BASELINE.filter((s) => !s.required),
    ...SAFEGUARD_LIBRARY.ROLLOUT,
  ];

  return {
    summary: {
      businessSummary:
        "Baseline rules indicate material revenue-governance risk and require structured safeguards before approval.",
      technicalSummary: `Change touches ${input.change.systems.length} systems with rollout ${input.change.rolloutMethod ?? "unknown"}.`,
    },
    risk: {
      riskLevel: baseline.baselineRiskLevel,
      riskScore: baseline.baselineRiskScore,
      confidenceScore: 55,
    },
    impact: {
      revenueImpactAreas:
        input.change.revenueImpactArea.length > 0
          ? (input.change.revenueImpactArea.filter(Boolean) as RevenueImpactReport["impact"]["revenueImpactAreas"])
          : ["BILLING"],
      customerImpactLevel: customerImpactLevel(input.change.customerImpact),
      estimatedExposureBand: exposureBandFromEstimate(input.change.revenueExposureEstimate),
      reportingImpact: true,
      operationalImpact: true,
    },
    systems: {
      primarySystems: input.change.systems.slice(0, 3),
      secondarySystems: input.change.systems.slice(3),
      integrationComplexity: complexityFromSystems(input.change.systems),
    },
    failureModes: failureModes.map((m) => ({ ...m })),
    historicalSignals: input.historical.topSignals,
    requiredSafeguards,
    recommendedSafeguards,
    requiredApprovals:
      input.change.approvers.length > 0
        ? input.change.approvers.map((role) => ({
            role,
            reason: "Role is already part of change approval context.",
          }))
        : DEFAULT_APPROVAL_ROLES,
    executiveSummary: {
      whyThisMatters:
        "This change affects core revenue operations and could create downstream financial/reporting issues if controls are incomplete.",
      worstReasonableOutcome:
        "Production change causes billing or reporting divergence, requiring incident response and customer remediation.",
      whatReducesRiskMost:
        "Phased rollout, explicit rollback plan, and finance/revops validation checks prior to full rollout.",
    },
  };
}
