import type { SupabaseClient } from "@supabase/supabase-js";
import { auditLog } from "@/lib/audit";
import { addTimelineEvent } from "@/services/timeline/addTimelineEvent";
import type { ExecutiveDecisionApi } from "./types";
import { buildExecutiveChangeView } from "./buildExecutiveChangeView";
import { validateExecutiveApprove, validateExecutiveDecisionPayload } from "./executiveDecisionGuards";

export type PersistResult =
  | { ok: true }
  | { ok: false; status: number; body: Record<string, unknown> };

export async function persistExecutiveDecision(
  supabase: SupabaseClient,
  args: {
    orgId: string;
    changeId: string;
    userId: string;
    decision: ExecutiveDecisionApi;
    comment?: string | null;
  }
): Promise<PersistResult> {
  const commentErr = validateExecutiveDecisionPayload(args.decision, args.comment);
  if (commentErr) {
    return { ok: false, status: 400, body: { error: commentErr } };
  }

  const view = await buildExecutiveChangeView(supabase, args.changeId);
  if (!view || view.id !== args.changeId) {
    return { ok: false, status: 404, body: { error: "Change not found" } };
  }

  if (args.decision === "APPROVE") {
    const blocked = validateExecutiveApprove(view);
    if (blocked) {
      return {
        ok: false,
        status: 409,
        body: { error: blocked.code, reasons: blocked.reasons },
      };
    }
  }

  const { error: insErr } = await supabase.from("executive_change_decisions").insert({
    org_id: args.orgId,
    change_id: args.changeId,
    user_id: args.userId,
    decision: args.decision,
    comment: args.comment?.trim() || null,
    recommendation_snapshot: view.recommendation,
    risk_level_snapshot: view.riskLevel,
    revenue_at_risk_snapshot: view.revenueAtRisk,
  });

  if (insErr) {
    return { ok: false, status: 500, body: { error: insErr.message } };
  }

  await addTimelineEvent({
    supabase,
    orgId: args.orgId,
    changeEventId: args.changeId,
    actorUserId: args.userId,
    eventType: "EXECUTIVE_DECISION",
    title: `Executive ${args.decision.replace(/_/g, " ").toLowerCase()}`,
    description: args.comment?.trim() || null,
    metadata: { decision: args.decision },
  });

  await auditLog(supabase, {
    orgId: args.orgId,
    actorId: args.userId,
    action: "executive_decision",
    entityType: "change",
    entityId: args.changeId,
    metadata: { decision: args.decision },
    changeEventId: args.changeId,
  });

  return { ok: true };
}
