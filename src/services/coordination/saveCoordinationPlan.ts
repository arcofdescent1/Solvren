import type { SupabaseClient } from "@supabase/supabase-js";
import type { CoordinationPlan, SavedCoordinationPlan } from "./coordinationTypes";

export async function saveCoordinationPlan(args: {
  supabase: SupabaseClient;
  orgId: string;
  changeId: string;
  inputHash: string;
  plan: CoordinationPlan;
  generatedBy?: "RULES_ONLY" | "HYBRID_AI" | "MANUAL_OVERRIDE";
  status?: "PENDING" | "COMPLETED" | "FAILED";
  createdByUserId?: string | null;
}): Promise<SavedCoordinationPlan> {
  const generatedBy = args.generatedBy ?? "RULES_ONLY";
  const status = args.status ?? "COMPLETED";

  const { data: latest } = await args.supabase
    .from("coordination_plans")
    .select("version")
    .eq("change_id", args.changeId)
    .eq("is_current", true)
    .maybeSingle();
  const nextVersion = Number(latest?.version ?? 0) + 1;

  await args.supabase
    .from("coordination_plans")
    .update({
      is_current: false,
      superseded_at: new Date().toISOString(),
    })
    .eq("change_id", args.changeId)
    .eq("is_current", true);

  const { data, error } = await args.supabase
    .from("coordination_plans")
    .insert({
      org_id: args.orgId,
      change_id: args.changeId,
      version: nextVersion,
      status,
      input_hash: args.inputHash,
      plan_json: args.plan,
      summary_text: args.plan.summary.coordinationSummary,
      is_current: true,
      generated_by: generatedBy,
      created_by_user_id: args.createdByUserId ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as SavedCoordinationPlan;
}
