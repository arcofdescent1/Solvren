import type { SupabaseClient } from "@supabase/supabase-js";
import { addTimelineEvent } from "@/services/timeline/addTimelineEvent";
import { buildRevenueImpactInput } from "./buildRevenueImpactInput";
import { calculateBaselineRisk } from "./calculateBaselineRisk";
import { generateRevenueImpactReport } from "./generateRevenueImpactReport";
import { saveRevenueImpactReport } from "./saveRevenueImpactReport";
import type { SavedRevenueImpactReport } from "./revenueImpactTypes";

function validateMinimumInputs(input: Awaited<ReturnType<typeof buildRevenueImpactInput>>) {
  const missing: string[] = [];
  if (!input.change.title) missing.push("title");
  if (!input.change.changeType) missing.push("changeType");
  if (!input.change.domain) missing.push("domain");
  if (input.change.systems.length === 0) missing.push("systems");
  if (!input.change.rolloutMethod) missing.push("rolloutMethod");
  return missing;
}

export async function runRevenueImpactGeneration(args: {
  supabase: SupabaseClient;
  orgId: string;
  changeId: string;
  actorUserId?: string | null;
  regenerate?: boolean;
}): Promise<{
  saved: SavedRevenueImpactReport;
  stale: boolean;
  missingFields: string[];
}> {
  const input = await buildRevenueImpactInput({
    supabase: args.supabase,
    changeId: args.changeId,
  });

  const missingFields = validateMinimumInputs(input);
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(", ")}`);
  }

  const { data: current } = await args.supabase
    .from("revenue_impact_reports")
    .select("id, input_hash")
    .eq("change_id", args.changeId)
    .eq("is_current", true)
    .maybeSingle();

  const stale = Boolean(current && current.input_hash !== input.inputHash);
  if (!args.regenerate && current && !stale) {
    const { data: existing } = await args.supabase
      .from("revenue_impact_reports")
      .select("*")
      .eq("id", current.id)
      .single();
    return {
      saved: existing as SavedRevenueImpactReport,
      stale,
      missingFields,
    };
  }

  const baseline = calculateBaselineRisk(input);
  const ai = await generateRevenueImpactReport({
    input,
    baseline,
  });

  const saved = await saveRevenueImpactReport({
    supabase: args.supabase,
    orgId: args.orgId,
    changeId: args.changeId,
    inputHash: input.inputHash,
    baseline,
    report: ai.report,
    generatedBy: ai.generatedBy,
    modelName: ai.modelName,
    promptVersion: ai.promptVersion,
    createdByUserId: args.actorUserId ?? null,
  });

  await addTimelineEvent({
    supabase: args.supabase,
    orgId: args.orgId,
    changeEventId: args.changeId,
    actorUserId: args.actorUserId ?? null,
    eventType: args.regenerate
      ? "REVENUE_IMPACT_REPORT_REGENERATED"
      : "REVENUE_IMPACT_REPORT_GENERATED",
    title: args.regenerate ? "Revenue Impact Report regenerated" : "Revenue Impact Report generated",
    description: `${saved.risk_level ?? "UNKNOWN"} risk (${saved.risk_score ?? 0}/100)`,
    metadata: {
      generated_by: saved.generated_by,
      risk_level: saved.risk_level,
      risk_score: saved.risk_score,
      version: saved.version,
      prompt_version: saved.prompt_version,
    },
  });

  return {
    saved,
    stale,
    missingFields,
  };
}
