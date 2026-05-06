import type { SupabaseClient } from "@supabase/supabase-js";
import { auditLog } from "@/lib/audit";
import { addTimelineEvent } from "@/services/timeline/addTimelineEvent";
import type { ExecutiveDecisionApi } from "./types";
import { buildExecutiveChangeView } from "./buildExecutiveChangeView";
import { validateExecutiveDecisionPayload } from "./executiveDecisionGuards";

export type ExecutiveDecisionAuditContext = {
  channel: "slack" | "email" | "web";
  tokenId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

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
    audit?: ExecutiveDecisionAuditContext;
  }
): Promise<PersistResult> {
  const commentErr = validateExecutiveDecisionPayload(args.decision, args.comment);
  if (commentErr) {
    return { ok: false, status: 400, body: { error: commentErr } };
  }

  const { data: changeRow, error: ceErr } = await supabase
    .from("change_events")
    .select("id, created_by")
    .eq("id", args.changeId)
    .eq("org_id", args.orgId)
    .maybeSingle();

  if (ceErr || !changeRow) {
    return { ok: false, status: 404, body: { error: "Change not found" } };
  }

  const view = await buildExecutiveChangeView(supabase, args.changeId);
  if (!view || view.id !== args.changeId) {
    return { ok: false, status: 404, body: { error: "Change not found" } };
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

  const cePatch: Record<string, unknown> = {};
  if (args.decision === "APPROVE") {
    cePatch.executive_blocked = false;
    cePatch.executive_snooze_until = null;
  } else if (args.decision === "DENY") {
    cePatch.executive_blocked = true;
  } else if (args.decision === "DELAY") {
    cePatch.executive_snooze_until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  }
  if (Object.keys(cePatch).length > 0) {
    await supabase.from("change_events").update(cePatch).eq("id", args.changeId).eq("org_id", args.orgId);
  }

  const createdBy = (changeRow as { created_by?: string | null }).created_by ?? null;
  const ownerId = createdBy && createdBy !== args.userId ? createdBy : null;

  if (args.decision === "REQUEST_INFO" && ownerId) {
    await supabase.from("in_app_notifications").insert({
      org_id: args.orgId,
      user_id: ownerId,
      change_event_id: args.changeId,
      title: "Executive requested information",
      body:
        args.comment?.trim() ||
        "An executive asked for more context on this change. Controls and domain approvals are unchanged.",
      severity: "WARNING",
      cta_label: "Open change",
      cta_url: `/changes/${args.changeId}`,
    });
  }

  if (args.decision === "DENY" && ownerId) {
    await supabase.from("in_app_notifications").insert({
      org_id: args.orgId,
      user_id: ownerId,
      change_event_id: args.changeId,
      title: "Executive blocked this change",
      body:
        args.comment?.trim() ||
        "Executive sign-off was denied. Domain approvals were not modified; review the executive decision on the timeline.",
      severity: "WARNING",
      cta_label: "Open change",
      cta_url: `/changes/${args.changeId}`,
    });
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

  const audit = args.audit;
  const ts = new Date().toISOString();
  await auditLog(supabase, {
    orgId: args.orgId,
    actorId: args.userId,
    action: "executive_decision",
    entityType: "change",
    entityId: args.changeId,
    metadata: {
      decision: args.decision,
      channel: audit?.channel ?? "web",
      decision_type: "executive",
      token_id: audit?.tokenId ?? null,
      user_id: args.userId,
      timestamp: ts,
      ip: audit?.ip ?? null,
      device: audit?.userAgent ?? null,
    },
    changeEventId: args.changeId,
  });

  return { ok: true };
}
