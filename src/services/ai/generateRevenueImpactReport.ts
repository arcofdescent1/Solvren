import { openai } from "@/lib/openai";
import type { RevenueImpactReport } from "@/services/ai/schemas/revenueImpactReport";
import { revenueImpactReportJsonSchema } from "@/services/ai/schemas/revenueImpactReport";

export async function generateRevenueImpactReport(args: {
  change: Record<string, unknown>;
}): Promise<{ report: RevenueImpactReport; model: string }> {
  const c = args.change;

  const input = {
    change_type: c.change_type ?? c.structured_change_type,
    systems_involved: c.systems_involved,
    revenue_surface: c.revenue_surface,
    rollout_method: c.rollout_method,
    backfill_required: c.backfill_required,
    customer_impact_expected: c.customer_impact_expected,
    affected_customer_segments: c.affected_customer_segments,
    planned_release_at: c.planned_release_at ?? c.requested_release_at,
    description: (c.intake as Record<string, unknown>)?.description ?? c.description,
    estimated_mrr_affected: c.estimated_mrr_affected,
    percent_customer_base_affected: c.percent_customer_base_affected,
  };

  const prompt = `You are a revenue operations risk analyst.
Given the structured change intake, return STRICT JSON only with the required fields.
No prose outside JSON. No extra keys. Every array must be non-empty if applicable; otherwise return [].

Rules:
- impactedRevenueSystems must be from systems_involved plus any implied systems.
- hiddenDependencies should include integrations and downstream reports/warehouses.
- requiredApprovals should list roles/teams (e.g., RevOps, Finance, Billing Eng, Data Eng, Legal) NOT people.
- testScenarios should be specific and runnable.
- rollbackPlan should be a checklist.
- estimatedRiskScore is 1-5.
- confidenceScore 0-1.

Input:
${JSON.stringify(input)}`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You return only valid JSON matching the required schema. No markdown, no extra text.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 1500,
    response_format: {
      type: "json_schema",
      json_schema: revenueImpactReportJsonSchema,
    } as const,
  });

  const raw = resp.choices?.[0]?.message?.content ?? "";
  const report = JSON.parse(raw) as RevenueImpactReport;
  return { report, model: "gpt-4o-mini" };
}
