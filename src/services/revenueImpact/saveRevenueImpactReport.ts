import type { SupabaseClient } from "@supabase/supabase-js";
import type { BaselineRisk, RevenueImpactReport, SavedRevenueImpactReport } from "./revenueImpactTypes";

export async function saveRevenueImpactReport(args: {
  supabase: SupabaseClient;
  orgId: string;
  changeId: string;
  inputHash: string;
  report: RevenueImpactReport;
  baseline: BaselineRisk;
  generatedBy: "RULES_ONLY" | "HYBRID_AI" | "MANUAL";
  modelName: string | null;
  promptVersion: string | null;
  status?: "PENDING" | "COMPLETED" | "FAILED";
  createdByUserId?: string | null;
}): Promise<SavedRevenueImpactReport> {
  const status = args.status ?? "COMPLETED";

  const { data: latest } = await args.supabase
    .from("revenue_impact_reports")
    .select("version")
    .eq("change_id", args.changeId)
    .eq("is_current", true)
    .maybeSingle();

  const nextVersion = Number(latest?.version ?? 0) + 1;

  await args.supabase
    .from("revenue_impact_reports")
    .update({
      is_current: false,
      superseded_at: new Date().toISOString(),
    })
    .eq("change_id", args.changeId)
    .eq("is_current", true);

  const payload = {
    org_id: args.orgId,
    change_id: args.changeId,
    version: nextVersion,
    status,
    generated_by: args.generatedBy,
    model_name: args.modelName,
    prompt_version: args.promptVersion,
    input_hash: args.inputHash,
    report_json: args.report,
    baseline_json: args.baseline,
    summary_text: args.report.executiveSummary.whyThisMatters,
    risk_score: args.report.risk.riskScore,
    risk_level: args.report.risk.riskLevel,
    confidence_score: args.report.risk.confidenceScore,
    is_current: true,
    created_by_user_id: args.createdByUserId ?? null,
  };

  const { data, error } = await args.supabase
    .from("revenue_impact_reports")
    .insert(payload)
    .select("*")
    .single();
  if (error) {
    throw new Error(error.message);
  }
  return data as SavedRevenueImpactReport;
}
