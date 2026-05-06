import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAttentionContext } from "@/lib/attention/buildAttentionContext";
import { delegateApproval } from "@/lib/attention/delegateApproval";
import { buildMaterialSnapshot } from "@/lib/attention/materialSnapshot";
import { computeAttentionReasonHash } from "@/lib/attention/reasonHash";
import { fetchLatestAttentionDelivery } from "@/lib/attention/notificationDeliveryLog";
import { persistDelegationDecision } from "@/lib/attention/persistDelegationDecision";
import { routeAttention } from "@/lib/attention/routeAttention";
import { shouldSuppressAttentionNotification } from "@/lib/attention/shouldSuppressNotification";
import type { AttentionEventType } from "@/lib/attention/types";
import { createExecutiveExternalActionToken } from "@/lib/external-actions/executiveActionToken";
import { env } from "@/lib/env";
import { resolveSlackDmUserIdWithLookupFallback } from "@/lib/slack/ensureSlackUserMapByEmail";

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

  const { data: installRow } = await admin
    .from("slack_installations")
    .select("team_id, bot_token")
    .eq("org_id", orgId)
    .eq("status", "ACTIVE")
    .maybeSingle();
  const slackTeamId = String((installRow as { team_id?: string } | null)?.team_id ?? "");
  const botToken = String((installRow as { bot_token?: string } | null)?.bot_token ?? "");

  const { data: orgSettings } = await admin
    .from("organization_settings")
    .select("executive_action_emails_enabled, email_enabled")
    .eq("org_id", orgId)
    .maybeSingle();

  const executiveEmailAllowed =
    !!(orgSettings as { executive_action_emails_enabled?: boolean } | null)
      ?.executive_action_emails_enabled &&
    !!(orgSettings as { email_enabled?: boolean } | null)?.email_enabled &&
    !!env.externalActionTokenSecret &&
    env.emailEnabled;

  let inserted = 0;
  const nowMs = Date.now();

  for (const route of routes) {
    if (route.routeType !== "IMMEDIATE" || route.channel !== "SLACK_DM") continue;
    if (route.persona !== "EXECUTIVE" && route.persona !== "SENIOR_TECH_LEADER") continue;

    const userId = route.userId;

    let slackUserId: string | null = null;
    if (botToken && slackTeamId) {
      slackUserId = await resolveSlackDmUserIdWithLookupFallback(admin, {
        orgId,
        userId,
        slackTeamId,
        botToken,
      });
    }

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

    const dedupe_slack = `executive_dm_notification:${orgId}:${changeEventId}:${userId}:${reasonHash.slice(0, 16)}`;
    const { data: dupeSlack } = await admin
      .from("notification_outbox")
      .select("id")
      .eq("dedupe_key", dedupe_slack)
      .gte("created_at", new Date(nowMs - 2 * 60 * 60 * 1000).toISOString())
      .maybeSingle();

    if (slackUserId && !dupeSlack) {
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
        dedupe_key: dedupe_slack,
      });
      if (!error) inserted += 1;
    }

    if (executiveEmailAllowed && route.persona === "EXECUTIVE") {
      const dedupe_email = `executive_external_action_email:${orgId}:${changeEventId}:${userId}:${reasonHash.slice(0, 16)}`;
      const { data: dupeEm } = await admin
        .from("notification_outbox")
        .select("id")
        .eq("dedupe_key", dedupe_email)
        .gte("created_at", new Date(nowMs - 2 * 60 * 60 * 1000).toISOString())
        .maybeSingle();
      if (dupeEm) continue;

      const token = await createExecutiveExternalActionToken(admin, {
        orgId,
        userId,
        changeEventId,
      });
      if (!token) continue;

      const { data: authU } = await admin.auth.admin.getUserById(userId);
      const em = authU?.user?.email?.trim();
      if (!em) continue;

      const { error: emErr } = await admin.from("notification_outbox").insert({
        org_id: orgId,
        change_event_id: changeEventId,
        channel: "EMAIL",
        template_key: "executive_external_action",
        payload: {
          recipients: [em],
          executiveActionPath: `/external-actions/${token.rawToken}`,
          changeTitle: title ?? changeEventId,
        },
        status: "PENDING",
        attempt_count: 0,
        last_error: null,
        available_at: new Date().toISOString(),
        dedupe_key: dedupe_email,
      });
      if (!emErr) inserted += 1;
    }
  }

  return { inserted };
}
