import type { SupabaseClient } from "@supabase/supabase-js";
import type { DelegationDecision } from "./delegateApproval";
import type { RoutingPersona } from "./types";

export async function persistDelegationDecision(
  admin: SupabaseClient,
  args: {
    orgId: string;
    changeId: string;
    fromPersona: RoutingPersona;
    fromUserId: string | null;
    decision: DelegationDecision;
    snapshotJson: Record<string, unknown>;
    eventType: string;
    routingReasonHash: string | null;
  }
): Promise<void> {
  const { decision, orgId, changeId, fromPersona, fromUserId, snapshotJson, eventType, routingReasonHash } =
    args;
  if (!decision.delegated || !decision.delegatedToUserId) return;
  await admin.from("attention_delegation_decisions").insert({
    org_id: orgId,
    change_id: changeId,
    from_persona: fromPersona,
    from_user_id: fromUserId,
    to_user_id: decision.delegatedToUserId,
    reason: decision.reason,
    snapshot_json: snapshotJson,
    event_type: eventType,
    routing_reason_hash: routingReasonHash,
  });
}
