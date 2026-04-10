import type { SupabaseClient } from "@supabase/supabase-js";

const TIMELINE_INTERVENTION_PREFIXES = [
  "APPROVAL_REQUEST",
  "SLACK_APPROVAL",
  "APPROVAL_INFO_REQUESTED",
  "APPROVAL_DELEGATED",
  "EVIDENCE_REQUIRED",
  "EVIDENCE_MISSING",
  "MISSING_EVIDENCE",
  "COORDINATION_EVIDENCE",
  "EXECUTIVE",
  "ATTENTION",
  "NUDGE",
  "REMINDER",
] as const;

const INTERVENTION_PREDICTION_TYPES = new Set([
  "APPROVAL_SLA_RISK",
  "MISSING_EVIDENCE_DELAY",
  "DEPLOYMENT_BLOCKER_RISK",
  "READINESS_DETERIORATING",
]);

function timelineSuggestsIntervention(eventType: string): boolean {
  const u = eventType.toUpperCase();
  return TIMELINE_INTERVENTION_PREFIXES.some((p) => u.includes(p));
}

export type QualifyingApprovalInterventionResult = {
  qualifies: boolean;
  interventionTypes: string[];
  firstInterventionAt?: string;
};

/**
 * Solvren signals that occurred before final approval completed (Phase 6 attribution gate).
 */
export async function hasQualifyingApprovalIntervention(
  admin: SupabaseClient,
  args: { changeEventId: string; finalApprovalCompletedAt: string }
): Promise<QualifyingApprovalInterventionResult> {
  const { changeEventId, finalApprovalCompletedAt } = args;
  const cutoff = new Date(finalApprovalCompletedAt).getTime();
  const types = new Set<string>();
  let firstAt: string | undefined;

  const bump = (label: string, at: string) => {
    types.add(label);
    const t = new Date(at).getTime();
    if (t > cutoff) return;
    if (!firstAt || t < new Date(firstAt).getTime()) firstAt = at;
  };

  const { data: tlines } = await admin
    .from("change_timeline_events")
    .select("event_type, created_at")
    .eq("change_event_id", changeEventId)
    .order("created_at", { ascending: true });

  for (const row of tlines ?? []) {
    const et = String((row as { event_type?: string }).event_type ?? "");
    const at = String((row as { created_at?: string }).created_at ?? "");
    if (!et || !at) continue;
    if (new Date(at).getTime() > cutoff) continue;
    if (timelineSuggestsIntervention(et)) {
      bump(`TIMELINE:${et}`, at);
    }
  }

  const { data: preds } = await admin
    .from("predicted_risk_events")
    .select("prediction_type, created_at")
    .eq("change_event_id", changeEventId);

  for (const row of preds ?? []) {
    const pt = String((row as { prediction_type?: string }).prediction_type ?? "");
    const at = String((row as { created_at?: string }).created_at ?? "");
    if (!pt || !at || new Date(at).getTime() > cutoff) continue;
    if (INTERVENTION_PREDICTION_TYPES.has(pt)) {
      bump(`PREDICTION:${pt}`, at);
    }
  }

  const { data: dels } = await admin
    .from("notification_delivery_log")
    .select("event_type, created_at")
    .eq("change_id", changeEventId)
    .lte("created_at", finalApprovalCompletedAt);

  for (const row of dels ?? []) {
    const et = String((row as { event_type?: string }).event_type ?? "");
    const at = String((row as { created_at?: string }).created_at ?? "");
    if (!at || new Date(at).getTime() > cutoff) continue;
    if (
      et.includes("APPROVAL") ||
      et.includes("EXECUTIVE") ||
      et.includes("OPERATOR") ||
      et.includes("ATTENTION")
    ) {
      bump(`DELIVERY_LOG:${et}`, at);
    }
  }

  const { data: deleg } = await admin
    .from("attention_delegation_decisions")
    .select("created_at, event_type")
    .eq("change_id", changeEventId)
    .lte("created_at", finalApprovalCompletedAt);

  for (const row of deleg ?? []) {
    const at = String((row as { created_at?: string }).created_at ?? "");
    if (!at || new Date(at).getTime() > cutoff) continue;
    bump("ATTENTION_DELEGATION", at);
  }

  const list = [...types];
  return {
    qualifies: list.length > 0,
    interventionTypes: list,
    firstInterventionAt: firstAt,
  };
}
