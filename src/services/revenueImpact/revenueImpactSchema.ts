import { z } from "zod";

const riskLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const impactAreaSchema = z.enum([
  "PRICING",
  "BILLING",
  "CONTRACTS",
  "REVREC",
  "REPORTING",
  "LEAD_ROUTING",
]);

export const revenueImpactReportSchema = z.object({
  summary: z.object({
    businessSummary: z.string().min(1),
    technicalSummary: z.string().min(1),
  }),
  risk: z.object({
    riskLevel: riskLevelSchema,
    riskScore: z.number().int().min(0).max(100),
    confidenceScore: z.number().int().min(0).max(100),
  }),
  impact: z.object({
    revenueImpactAreas: z.array(impactAreaSchema),
    customerImpactLevel: z.enum(["NONE", "LOW", "MODERATE", "HIGH"]),
    estimatedExposureBand: z.enum(["NONE", "LOW", "MEDIUM", "HIGH", "SEVERE"]),
    reportingImpact: z.boolean(),
    operationalImpact: z.boolean(),
  }),
  systems: z.object({
    primarySystems: z.array(z.string()),
    secondarySystems: z.array(z.string()),
    integrationComplexity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  }),
  failureModes: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().min(1),
      severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
      likelihood: z.enum(["LOW", "MEDIUM", "HIGH"]),
      signals: z.array(z.string()),
    })
  ),
  historicalSignals: z.array(
    z.object({
      signalKey: z.string().min(1),
      description: z.string().min(1),
      strength: z.enum(["LOW", "MEDIUM", "HIGH"]),
    })
  ),
  requiredSafeguards: z.array(
    z.object({
      code: z.string().min(1),
      title: z.string().min(1),
      reason: z.string().min(1),
    })
  ),
  recommendedSafeguards: z.array(
    z.object({
      code: z.string().min(1),
      title: z.string().min(1),
      reason: z.string().min(1),
    })
  ),
  requiredApprovals: z.array(
    z.object({
      role: z.string().min(1),
      reason: z.string().min(1),
    })
  ),
  executiveSummary: z.object({
    whyThisMatters: z.string().min(1),
    worstReasonableOutcome: z.string().min(1),
    whatReducesRiskMost: z.string().min(1),
  }),
});

export type RevenueImpactReportSchema = z.infer<typeof revenueImpactReportSchema>;

export const revenueImpactReportJsonSchema = {
  name: "revenue_impact_report_v1",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "summary",
      "risk",
      "impact",
      "systems",
      "failureModes",
      "historicalSignals",
      "requiredSafeguards",
      "recommendedSafeguards",
      "requiredApprovals",
      "executiveSummary",
    ],
    properties: {
      summary: {
        type: "object",
        additionalProperties: false,
        required: ["businessSummary", "technicalSummary"],
        properties: {
          businessSummary: { type: "string" },
          technicalSummary: { type: "string" },
        },
      },
      risk: {
        type: "object",
        additionalProperties: false,
        required: ["riskLevel", "riskScore", "confidenceScore"],
        properties: {
          riskLevel: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
          riskScore: { type: "integer", minimum: 0, maximum: 100 },
          confidenceScore: { type: "integer", minimum: 0, maximum: 100 },
        },
      },
      impact: {
        type: "object",
        additionalProperties: false,
        required: [
          "revenueImpactAreas",
          "customerImpactLevel",
          "estimatedExposureBand",
          "reportingImpact",
          "operationalImpact",
        ],
        properties: {
          revenueImpactAreas: {
            type: "array",
            items: {
              type: "string",
              enum: ["PRICING", "BILLING", "CONTRACTS", "REVREC", "REPORTING", "LEAD_ROUTING"],
            },
          },
          customerImpactLevel: { type: "string", enum: ["NONE", "LOW", "MODERATE", "HIGH"] },
          estimatedExposureBand: { type: "string", enum: ["NONE", "LOW", "MEDIUM", "HIGH", "SEVERE"] },
          reportingImpact: { type: "boolean" },
          operationalImpact: { type: "boolean" },
        },
      },
      systems: {
        type: "object",
        additionalProperties: false,
        required: ["primarySystems", "secondarySystems", "integrationComplexity"],
        properties: {
          primarySystems: { type: "array", items: { type: "string" } },
          secondarySystems: { type: "array", items: { type: "string" } },
          integrationComplexity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
        },
      },
      failureModes: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "description", "severity", "likelihood", "signals"],
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
            likelihood: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
            signals: { type: "array", items: { type: "string" } },
          },
        },
      },
      historicalSignals: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["signalKey", "description", "strength"],
          properties: {
            signalKey: { type: "string" },
            description: { type: "string" },
            strength: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
          },
        },
      },
      requiredSafeguards: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["code", "title", "reason"],
          properties: {
            code: { type: "string" },
            title: { type: "string" },
            reason: { type: "string" },
          },
        },
      },
      recommendedSafeguards: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["code", "title", "reason"],
          properties: {
            code: { type: "string" },
            title: { type: "string" },
            reason: { type: "string" },
          },
        },
      },
      requiredApprovals: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["role", "reason"],
          properties: {
            role: { type: "string" },
            reason: { type: "string" },
          },
        },
      },
      executiveSummary: {
        type: "object",
        additionalProperties: false,
        required: ["whyThisMatters", "worstReasonableOutcome", "whatReducesRiskMost"],
        properties: {
          whyThisMatters: { type: "string" },
          worstReasonableOutcome: { type: "string" },
          whatReducesRiskMost: { type: "string" },
        },
      },
    },
  },
} as const;
