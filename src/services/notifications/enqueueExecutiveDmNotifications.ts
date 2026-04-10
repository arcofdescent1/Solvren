import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAttentionContext } from "@/lib/attention/buildAttentionContext";
import { delegateApproval } from "@/lib/attention/delegateApproval";
import { buildMaterialSnapshot } from "@/lib/attention/materialSnapshot";
import { computeAttentionReasonHash } from "@/lib/attention/reasonHash";
import { fetchLatestAttentionDelivery, insertAttentionDeliveryLog } from "@/lib/attention/notificationDeliveryLog";
import { persistDelegationDecision } from "@/lib/attention/persistDelegationDecision";
import { routeAttention } from "@/lib/attention/routeAttention";
import { shouldSuppressAttentionNotification } from "@/lib/attention/shouldSuppressNotification";
import type { AttentionEventType } from "@/lib/attention/types";

function personaRevenueThresholdUsd(
  persona: "EXECUTIVE" | "SENIOR_TECH_LEADER",
  ctx: import("@/lib/attention/types").AttentionContext
): number {
  if (persona === "EXECUTIVE") return ctx.settings.executiveRevenueThresholdUsd;
  return ctx.settings.seniorTechRevenueThresholdUsd;
}

/**
 * Enqueue per-user Slack DMs for executive + senior tech personas when Phase 2 routing is IMMEDIATE.
 * Uses admin/service-capable client for suppression queries and inserts.
 */
export async function enqueueExecutiveDmNotifications(
  admin: SupabaseClient,
  args: {
    orgId: string;
    changeEventId: string;
    title: string | null;
    riskBucket: string | null;
    eventType?: AttentionEventType;
  }
): Promise<{ inserted: number }> {
  const { orgId, changeEventId, title, riskBucket } = args;
  const eventType: AttentionEventType = args.eventType ?? "APPROVAL_REQUIRED";

  const context = await buildAttentionContext(admin, changeEventId);
  if (!context || context.orgId !== orgId) {
    return { inserted: 0 };
  }

  const delegation = delegateApproval(context);
  if (delegation.delegated) {
    await persistDelegationDecision(admin, {
      orgId,
      changeId: changeEventId,
      fromPersona: "EXECUTIVE",
      fromUserId: null,
      decision: delegation,
      snapshotJson: {
        recommendation: context.view.recommendation,
        riskLevel: context.view.riskLevel,
        delegatedTo: delegation.delegatedToUserId,
      },
      eventType,
      routingReasonHash: null,
    });
  }

  const routes = routeAttention({ eventType, context });

  let inserted = 0;
  const nowMs = Date.now();

  for (const route of routes) {
    if (route.routeType !== "IMMEDIATE" || route.channel !== "SLACK_DM") continue;
    if (route.persona !== "EXECUTIVE" && route.persona !== "SENIOR_TECH_LEADER") continue;

    const userId = route.userId;
    const { data: map } = await admin
      .from("slack_user_map")
      .select("slack_user_id")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    const slackUserId = (map as { slack_user_id?: string } | null)?.slack_user_id;
    if (!slackUserId) continue;

    const threshold = personaRevenueThresholdUsd(route.persona, context);
    const material = buildMaterialSnapshot({
      view: context.view,
      settings: context.settings,
      personaRevenueThreshold: threshold,
      primaryReasonCode: route.primaryReasonCode,
    });
    const reasonHash = computeAttentionReasonHash({
      userId,
      changeId: changeEventId,
      eventType,
      primaryReasonCode: route.primaryReasonCode,
      material,
    });

    const last = await fetchLatestAttentionDelivery(admin, userId, changeEventId);
    if (
      shouldSuppressAttentionNotification({
        eventType,
        nowMs,
        last,
        nextReasonHash: reasonHash,
        nextMaterial: material,
      })
    ) {
      continue;
    }

    const dedupe_key = `executive_dm_notification:${orgId}:${changeEventId}:${userId}:${reasonHash.slice(0, 16)}`;
    const { data: dupe } = await admin
      .from("notification_outbox")
      .select("id")
      .eq("dedupe_key", dedupe_key)
      .gte("created_at", new Date(nowMs - 2 * 60 * 60 * 1000).toISOString())
      .maybeSingle();
    if (dupe) continue;

    const { error } = await admin.from("notification_outbox").insert({
      org_id: orgId,
      change_event_id: changeEventId,
      channel: "SLACK",
      template_key: "executive_dm_notification",
      payload: {
        changeEventId,
        title: title ?? changeEventId,
        risk_bucket: riskBucket,
        slackUserId,
        orgId,
        userId,
        eventType,
        interruptionReason: route.reason,
        primaryReasonCode: route.primaryReasonCode,
        reasonHash,
        routeType: route.routeType,
        channel: route.channel,
        deliveryTemplate: route.deliveryTemplate,
        materialSnapshot: material,
      },
      status: "PENDING",
      attempt_count: 0,
      last_error: null,
      available_at: new Date().toISOString(),
      dedupe_key,
    });
    if (!error) inserted += 1;
  }

  return { inserted };
}
