import type { SupabaseClient } from "@supabase/supabase-js";
import { addTimelineEvent } from "@/services/timeline/addTimelineEvent";
import { buildCoordinationInput } from "./buildCoordinationInput";
import { generateCoordinationPlan } from "./generateCoordinationPlan";
import { saveCoordinationPlan } from "./saveCoordinationPlan";
import type { SavedCoordinationPlan } from "./coordinationTypes";

export async function runCoordinationPlanGeneration(args: {
  supabase: SupabaseClient;
  orgId: string;
  changeId: string;
  actorUserId?: string | null;
  regenerate?: boolean;
}): Promise<{
  saved: SavedCoordinationPlan;
  stale: boolean;
}> {
  const input = await buildCoordinationInput({
    supabase: args.supabase,
    changeId: args.changeId,
  });

  const { data: current } = await args.supabase
    .from("coordination_plans")
    .select("id, input_hash")
    .eq("change_id", args.changeId)
    .eq("is_current", true)
    .maybeSingle();

  const stale = Boolean(current && current.input_hash !== input.inputHash);
  if (!args.regenerate && current && !stale) {
    const { data: existing } = await args.supabase
      .from("coordination_plans")
      .select("*")
      .eq("id", current.id)
      .single();
    return {
      saved: existing as SavedCoordinationPlan,
      stale,
    };
  }

  const plan = generateCoordinationPlan(input);
  const saved = await saveCoordinationPlan({
    supabase: args.supabase,
    orgId: args.orgId,
    changeId: args.changeId,
    inputHash: input.inputHash,
    plan,
    generatedBy: "RULES_ONLY",
    createdByUserId: args.actorUserId ?? null,
  });

  await addTimelineEvent({
    supabase: args.supabase,
    orgId: args.orgId,
    changeEventId: args.changeId,
    actorUserId: args.actorUserId ?? null,
    eventType: args.regenerate ? "COORDINATION_PLAN_REGENERATED" : "COORDINATION_PLAN_GENERATED",
    title: args.regenerate ? "Coordination plan regenerated" : "Coordination plan generated",
    description: `${saved.plan_json.approvals.suggestedApprovers.length} approver suggestions, ${saved.plan_json.blockers.length} blocker(s)`,
    metadata: {
      version: saved.version,
      blocker_count: saved.plan_json.blockers.length,
      suggested_approver_count: saved.plan_json.approvals.suggestedApprovers.length,
      suggested_evidence_count:
        saved.plan_json.evidence.requiredItems.length +
        saved.plan_json.evidence.recommendedItems.length,
    },
  });

  if (saved.plan_json.blockers.length > 0) {
    await addTimelineEvent({
      supabase: args.supabase,
      orgId: args.orgId,
      changeEventId: args.changeId,
      actorUserId: args.actorUserId ?? null,
      eventType: "COORDINATION_BLOCKER_DETECTED",
      title: "Coordination blockers detected",
      description: `${saved.plan_json.blockers.filter((b) => b.severity === "ERROR").length} error blocker(s), ${saved.plan_json.blockers.filter((b) => b.severity === "WARNING").length} warning(s)`,
      metadata: {
        blockers: saved.plan_json.blockers,
      },
    });
  }

  return { saved, stale };
}
