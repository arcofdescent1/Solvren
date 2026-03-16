export type RevenueImpactReport = {
  impactedRevenueSystems: string[];
  hiddenDependencies: string[];
  financialRiskFactors: string[];
  reportingImpactAreas: string[];
  requiredStakeholders: string[];
  requiredApprovals: string[];
  testScenarios: string[];
  customerCommunicationChecklist: string[];
  rollbackPlan: string[];
  estimatedRiskScore: 1 | 2 | 3 | 4 | 5;
  riskExplanation: string;
  confidenceScore: number;
};

export const revenueImpactReportJsonSchema = {
  name: "revenue_impact_report",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
  required: [
    "impactedRevenueSystems",
    "hiddenDependencies",
    "financialRiskFactors",
    "reportingImpactAreas",
    "requiredStakeholders",
    "requiredApprovals",
    "testScenarios",
    "customerCommunicationChecklist",
    "rollbackPlan",
    "estimatedRiskScore",
    "riskExplanation",
    "confidenceScore",
  ],
  properties: {
    impactedRevenueSystems: { type: "array", items: { type: "string" } },
    hiddenDependencies: { type: "array", items: { type: "string" } },
    financialRiskFactors: { type: "array", items: { type: "string" } },
    reportingImpactAreas: { type: "array", items: { type: "string" } },
    requiredStakeholders: { type: "array", items: { type: "string" } },
    requiredApprovals: { type: "array", items: { type: "string" } },
    testScenarios: { type: "array", items: { type: "string" } },
    customerCommunicationChecklist: { type: "array", items: { type: "string" } },
    rollbackPlan: { type: "array", items: { type: "string" } },
    estimatedRiskScore: { type: "integer", minimum: 1, maximum: 5 },
    riskExplanation: { type: "string" },
    confidenceScore: { type: "number", minimum: 0, maximum: 1 },
  },
  },
} as const;
