/**
 * IES: Enqueue Slack message into slack_message_deliveries for async delivery.
 * Used when org has Slack app (OAuth) installed.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type EnqueueSlackDeliveryArgs = {
  orgId: string;
  integrationConnectionId?: string | null;
  changeId?: string | null;
  approvalId?: string | null;
  messageType: string;
  destinationType: "channel" | "user_dm";
  destinationId: string;
  payload: { method: string; args: Record<string, unknown>; meta?: Record<string, unknown> };
  idempotencyKey: string;
};

export async function enqueueSlackDelivery(
  db: SupabaseClient,
  args: EnqueueSlackDeliveryArgs
): Promise<{ id?: string }> {
  const {
    orgId,
    integrationConnectionId,
    changeId,
    approvalId,
    messageType,
    destinationType,
    destinationId,
    payload,
    idempotencyKey,
  } = args;

  const channelId =
    destinationType === "channel"
      ? destinationId
      : (payload.args?.channel as string) ?? null;

  const { data, error } = await db
    .from("slack_message_deliveries")
    .upsert(
      {
        org_id: orgId,
        integration_connection_id: integrationConnectionId ?? null,
        change_id: changeId ?? null,
        approval_id: approvalId ?? null,
        message_type: messageType,
        destination_type: destinationType,
        destination_id: destinationId,
        slack_channel_id: channelId,
        idempotency_key: idempotencyKey,
        status: "pending",
        payload,
        attempt_count: 0,
        next_retry_at: new Date().toISOString(),
      },
      { onConflict: "idempotency_key", ignoreDuplicates: true }
    )
    .select("id")
    .maybeSingle();

  if (error && !String(error.message).includes("duplicate key")) {
    throw new Error(error.message);
  }

  return { id: data?.id };
}
