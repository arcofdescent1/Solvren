// src/services/slack/submitChangeFromSlack.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { submitChangeFromSlack as submitFromSlackCore } from "@/services/changes/submitChangeFromSlack";

type Inputs = {
  orgId: string;
  actorUserId: string | null;
  title: string;
  description?: string | null;
  estimatedMrrAffected?: number | null;
  percentCustomerBaseAffected?: number | null;
  revenueSurface?: string | null;
};

/**
 * Single entry point for Slack modal submit.
 * Creates change, runs full scoring + submit flow, returns change + approvalId.
 */
export async function submitChangeFromSlack(
  supabase: SupabaseClient,
  input: Inputs
) {
  if (!input.actorUserId) {
    throw new Error("actorUserId required to create change");
  }

  const { changeId } = await submitFromSlackCore(supabase, {
    orgId: input.orgId,
    createdByUserId: input.actorUserId,
    title: input.title,
    description: input.description,
    estimatedMrrAffected: input.estimatedMrrAffected,
    percentCustomerBaseAffected: input.percentCustomerBaseAffected,
    revenueSurface: input.revenueSurface,
  });

  const [{ data: full, error: reloadErr }, { data: assessment }] =
    await Promise.all([
      supabase
        .from("change_events")
        .select(
          "id, org_id, title, status, submitted_at, due_at, revenue_at_risk, revenue_exposure_multiplier, revenue_surface, domain, estimated_mrr_affected, percent_customer_base_affected, revenue_risk_score"
        )
        .eq("id", changeId)
        .maybeSingle(),
      supabase
        .from("impact_assessments")
        .select("risk_score_raw")
        .eq("change_event_id", changeId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (reloadErr) throw new Error(reloadErr.message);
  if (!full) throw new Error("Failed to load change after submit");

  const riskScore = assessment?.risk_score_raw ?? 0;
  const changeWithRisk = {
    ...full,
    risk_score: riskScore,
  };

  const { data: approvalRow } = await supabase
    .from("approvals")
    .select("id")
    .eq("change_event_id", changeId)
    .eq("decision", "PENDING")
    .order("created_at", { ascending: true })
    .maybeSingle();

  return {
    change: changeWithRisk,
    approvalId: (approvalRow?.id as string) ?? null,
  };
}
