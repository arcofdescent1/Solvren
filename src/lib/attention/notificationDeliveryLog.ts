import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttentionEventType, MaterialSnapshotV1 } from "./types";
import type { LastDeliveryRecord } from "./shouldSuppressNotification";
import type { AttentionRoutingResult } from "./types";

function parseMaterial(raw: unknown): MaterialSnapshotV1 | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as MaterialSnapshotV1;
}

export async function fetchLatestAttentionDelivery(
  admin: SupabaseClient,
  userId: string,
  changeId: string
): Promise<LastDeliveryRecord | null> {
  const { data, error } = await admin
    .from("notification_delivery_log")
    .select("created_at, reason_hash, material_snapshot_json")
    .eq("user_id", userId)
    .eq("change_id", changeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const createdAtMs = Date.parse(String((data as { created_at: string }).created_at));
  if (!Number.isFinite(createdAtMs)) return null;
  return {
    createdAtMs,
    reasonHash: String((data as { reason_hash: string }).reason_hash),
    material: parseMaterial((data as { material_snapshot_json?: unknown }).material_snapshot_json),
  };
}

export async function insertAttentionDeliveryLog(
  admin: SupabaseClient,
  args: {
    orgId: string;
    userId: string;
    changeId: string;
    eventType: AttentionEventType;
    route: AttentionRoutingResult;
    reasonHash: string;
    material: MaterialSnapshotV1;
    primaryReasonCode: string;
  }
): Promise<void> {
  await admin.from("notification_delivery_log").insert({
    org_id: args.orgId,
    user_id: args.userId,
    change_id: args.changeId,
    event_type: args.eventType,
    route_type: args.route.routeType,
    channel: args.route.channel,
    delivery_template: args.route.deliveryTemplate,
    reason_hash: args.reasonHash,
    primary_reason_code: args.primaryReasonCode,
    material_snapshot_json: args.material,
  });
}
