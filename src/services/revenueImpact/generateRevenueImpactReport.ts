import { generateStructuredObject } from "@/services/ai/generateStructuredObject";
import { revenueImpactReportJsonSchema, revenueImpactReportSchema } from "./revenueImpactSchema";
import { fallbackRevenueImpactReport } from "./fallbackRevenueImpactReport";
import type { BaselineRisk, RevenueImpactInput, RevenueImpactReport } from "./revenueImpactTypes";

export const REVENUE_IMPACT_PROMPT_VERSION = "revenue-impact-v1";
const DEFAULT_MODEL = "gpt-4o-mini";

function buildPrompt(input: RevenueImpactInput, baseline: BaselineRisk): string {
  return [
    "Generate a Revenue Impact Report JSON artifact for enterprise change governance.",
    "Only use supplied inputs and baseline/historical evidence.",
    "Never invent incidents, systems, approvals, or dollar values not present in input.",
    "If uncertain, lower confidenceScore; do not fabricate details.",
    "",
    "Normalized change input:",
    JSON.stringify(input, null, 2),
    "",
    "Deterministic baseline:",
    JSON.stringify(baseline, null, 2),
    "",
    "Output contract:",
    JSON.stringify(revenueImpactReportJsonSchema.schema, null, 2),
  ].join("\n");
}

export async function generateRevenueImpactReport(args: {
  input: RevenueImpactInput;
  baseline: BaselineRisk;
  model?: string;
}): Promise<{
  report: RevenueImpactReport;
  generatedBy: "HYBRID_AI" | "RULES_ONLY";
  modelName: string | null;
  promptVersion: string;
}> {
  const model = args.model ?? DEFAULT_MODEL;
  const systemInstruction =
    "You are a revenue governance analyst. Return VALID JSON only. No markdown, no prose outside JSON.";

  try {
    const prompt = buildPrompt(args.input, args.baseline);
    let parsed = await generateStructuredObject<unknown>({
      model,
      systemInstruction,
      userPrompt: prompt,
      schema: revenueImpactReportJsonSchema as unknown as Record<string, unknown>,
      temperature: 0.1,
      maxTokens: 2200,
    });

    let validated = revenueImpactReportSchema.safeParse(parsed);
    if (!validated.success) {
      parsed = await generateStructuredObject<unknown>({
        model,
        systemInstruction,
        userPrompt: `${prompt}\n\nPrevious output was invalid. Return valid JSON matching schema exactly.`,
        schema: revenueImpactReportJsonSchema as unknown as Record<string, unknown>,
        temperature: 0.1,
        maxTokens: 2200,
      });
      validated = revenueImpactReportSchema.safeParse(parsed);
    }

    if (!validated.success) {
      const fallback = fallbackRevenueImpactReport({
        input: args.input,
        baseline: args.baseline,
      });
      return {
        report: fallback,
        generatedBy: "RULES_ONLY",
        modelName: null,
        promptVersion: REVENUE_IMPACT_PROMPT_VERSION,
      };
    }

    return {
      report: validated.data,
      generatedBy: "HYBRID_AI",
      modelName: model,
      promptVersion: REVENUE_IMPACT_PROMPT_VERSION,
    };
  } catch {
    return {
      report: fallbackRevenueImpactReport({
        input: args.input,
        baseline: args.baseline,
      }),
      generatedBy: "RULES_ONLY",
      modelName: null,
      promptVersion: REVENUE_IMPACT_PROMPT_VERSION,
    };
  }
}
