import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderTemplate } from "@/services/notifications/templates";
import { resolveRecipientsForTemplate } from "@/services/notifications/resolveRecipients";
import { slackPostMessage } from "@/lib/notify/slack";
import { deliverSlack } from "@/services/notifications/deliverSlack";
import { buildApprovalNeededBlocks } from "@/lib/server/slack/blocks";
import { fetchMitigationsForSignals } from "@/services/risk/mitigationsDb";
import { buildDailyInboxBlocks } from "@/lib/server/slack/dailyInboxBlocks";
import { buildWeeklyDigestBlocks } from "@/lib/server/slack/weeklyDigestBlocks";
import {
  planFromString,
  canUseSlack,
  canUseWeeklyDigest,
} from "@/services/billing/entitlements";
import { Resend } from "resend";
import { env } from "@/lib/env";
import { requireCronSecret } from "@/lib/cronAuth";
import { logError, logInfo } from "@/lib/observability/logger";
import { buildExecutiveChangeView } from "@/lib/executive/buildExecutiveChangeView";
import { buildExecutiveDmSlackBlocks } from "@/lib/server/slack/executiveDmBlocks";
import { buildPhase5PredictionSlackBlocks } from "@/services/slack/blockBuilders";
import { slackApi } from "@/lib/server/slack/slackApi";
import { insertAttentionDeliveryLog } from "@/lib/attention/notificationDeliveryLog";
import type { AttentionRoutingResult } from "@/lib/attention/types";

const MAX_BATCH = 50;
const MAX_ATTEMPTS = 8;

function nextAvailableAt(attempts: number) {
  const mins = [1, 5, 15, 60, 240, 720, 1440][Math.min(attempts, 6)] ?? 1440;
  return new Date(Date.now() + mins * 60 * 1000).toISOString();
}

const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;

function absoluteUrl(path: string) {
  return path.startsWith("http") ? path : `${env.appUrl}${path}`;
}

/**
 * Cron processor must use service-role (admin) client for ALL DB operations,
 * otherwise RLS blocks outbox reads/writes and in-app inserts.
 */
type Db = Awaited<ReturnType<typeof createAdminClient>>;

async function getOrgSettings(db: Db, orgId: string) {
  const { data, error } = await db
    .from("organization_settings")
    .select("slack_webhook_url, slack_enabled, email_enabled, notification_emails")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data ?? {
    slack_webhook_url: null,
    slack_enabled: false,
    email_enabled: false,
    notification_emails: [],
  };
}

function isWeeklyDigest(templateKey: string) {
  const k = (templateKey ?? "").toLowerCase();
  return k.includes("weekly") && k.includes("digest");
}

/** Policy: allow non-digest email alerts on FREE plan? Set false for paid-only. */
const ALLOW_NON_DIGEST_EMAIL_ON_FREE = false;

async function sendSlack(
  webhookUrl: string,
  title: string,
  body: string,
  ctaLabel: string,
  ctaUrl: string
) {
  const text = `*${title}*\n${body}\n<${absoluteUrl(ctaUrl)}|${ctaLabel}>`;
  const resp = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`Slack send failed: ${resp.status} ${t}`.slice(0, 500));
  }
}

async function sendEmail(
  to: string[],
  subject: string,
  body: string,
  ctaLabel: string,
  ctaUrl: string
) {
  if (!resend) throw new Error("RESEND_API_KEY not set");
  const from = env.emailFrom;
  if (!from) throw new Error("EMAIL_FROM (or RESEND_FROM) not set");

  const html = `
    <div style="font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Helvetica,Arial;">
      <h2>${subject}</h2>
      <p>${body}</p>
      <p><a href="${absoluteUrl(ctaUrl)}">${ctaLabel}</a></p>
    </div>
  `;

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
    text: `${body}\n\n${ctaLabel}: ${absoluteUrl(ctaUrl)}`,
  });
  if (error) throw new Error(error.message);
}

export async function POST(req: Request) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("notification_outbox")
    .select(
      "id, org_id, change_event_id, channel, template_key, payload, attempt_count, available_at, status, dedupe_key"
    )
    .eq("status", "PENDING")
    .lte("available_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(MAX_BATCH);

  if (error) {
    logError("notifications.process.outbox_fetch_failed", new Error(error.message), {
      route: "/api/notifications/process",
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!rows || rows.length === 0)
    return NextResponse.json({ ok: true, processed: 0, errors: 0 });

  let processed = 0;
  let errors = 0;

  const billingCache = new Map<string, { plan_key: string; status: string | null }>();
  const settingsCache = new Map<
    string,
    {
      slack_webhook_url: string | null;
      slack_enabled: boolean;
      email_enabled: boolean;
      notification_emails: string[];
    }
  >();

  async function getBillingForOrg(orgId: string) {
    const cached = billingCache.get(orgId);
    if (cached) return cached;

    const { data } = await admin
      .from("billing_accounts")
      .select("plan_key, status")
      .eq("org_id", orgId)
      .maybeSingle();

    const plan_key = (data?.plan_key ?? "FREE") as string;
    const status = data?.status ?? null;
    const out = { plan_key, status };
    billingCache.set(orgId, out);
    return out;
  }

  async function getSettingsForOrg(orgId: string) {
    const cached = settingsCache.get(orgId);
    if (cached) return cached;

    const s = await getOrgSettings(admin, orgId);
    const out = {
      slack_webhook_url: (s?.slack_webhook_url ?? null) as string | null,
      slack_enabled: Boolean(s?.slack_enabled),
      email_enabled: Boolean(s?.email_enabled),
      notification_emails: (s?.notification_emails ?? []) as string[],
    };
    settingsCache.set(orgId, out);
    return out;
  }

  async function markBlocked(
    outboxId: string,
    reason: string,
    attemptCount: number
  ) {
    await admin
      .from("notification_outbox")
      .update({
        status: "FAILED",
        last_error: reason,
        attempt_count: attemptCount + 1,
        available_at: new Date().toISOString(),
      })
      .eq("id", outboxId);
  }

  for (const row of rows) {
    const { error: leaseErr } = await admin
      .from("notification_outbox")
      .update({ status: "PROCESSING" })
      .eq("id", row.id)
      .eq("status", "PENDING");

    if (leaseErr) continue;

    try {
      const rendered = renderTemplate(row.template_key, row.payload ?? {});
      if (!rendered)
        throw new Error(`Unknown template_key: ${row.template_key}`);

      if (row.channel === "IN_APP") {
        const recipients = await resolveRecipientsForTemplate(
          admin,
          row.org_id ?? "",
          row.template_key ?? "",
          (row.payload ?? {}) as Record<string, unknown>
        );

        let deliveredCount = 0;

        if (recipients.length > 0) {
          const inserts = recipients.map((userId) => ({
            org_id: row.org_id,
            user_id: userId,
            change_event_id: row.change_event_id,
            title: rendered.title,
            body: rendered.body,
            severity: rendered.severity,
            cta_label: rendered.cta_label,
            cta_url: rendered.cta_url,
          }));

          const { error: insErr } = await admin
            .from("in_app_notifications")
            .insert(inserts);

          if (insErr) throw new Error(insErr.message);
          deliveredCount = inserts.length;
        }

        const { error: sentErr } = await admin
          .from("notification_outbox")
          .update({
            status: "SENT",
            sent_at: new Date().toISOString(),
            last_error: null,
            delivered_count: deliveredCount,
          })
          .eq("id", row.id);

        if (sentErr) throw new Error(sentErr.message);

        processed += 1;
        continue;
      }

      const orgId = String(row.org_id);
      const settings = await getSettingsForOrg(orgId);
      const { plan_key, status } = await getBillingForOrg(orgId);

      if (row.channel === "SLACK") {
        if (!canUseSlack(planFromString(plan_key), status)) {
          await markBlocked(
            String(row.id),
            "blocked_plan_not_entitled_for_slack",
            Number(row.attempt_count ?? 0)
          );
          processed += 1;
          continue;
        }
        if (!settings.slack_enabled) {
          await markBlocked(
            String(row.id),
            "blocked_slack_disabled_in_settings",
            Number(row.attempt_count ?? 0)
          );
          processed += 1;
          continue;
        }

        const p = (row.payload ?? {}) as Record<string, unknown>;
        const { data: install } = await admin
          .from("slack_installations")
          .select("bot_token, default_channel_id, team_id")
          .eq("org_id", row.org_id)
          .eq("status", "ACTIVE")
          .maybeSingle();

        // Raw Slack API delivery (method + args from payload)
        if (p.method && p.args && install?.bot_token) {
          try {
            const json = await deliverSlack({
              botToken: install.bot_token,
              payload: p as { method: string; args: Record<string, unknown>; meta?: Record<string, unknown> },
            });
            const changeId = (p as { meta?: { changeId?: string } }).meta?.changeId;
            if (
              row.channel === "SLACK" &&
              p.method === "chat.postMessage" &&
              changeId &&
              (json as { ts?: string; channel?: string }).ts &&
              (json as { ts?: string; channel?: string }).channel
            ) {
              await admin
                .from("change_events")
                .update({
                  slack_channel_id: (json as { channel?: string }).channel,
                  slack_message_ts: (json as { ts?: string }).ts,
                })
                .eq("id", changeId);
            }
            await admin
              .from("notification_outbox")
              .update({
                status: "SENT",
                sent_at: new Date().toISOString(),
                last_error: null,
                delivered_count: 1,
              })
              .eq("id", row.id);
            processed += 1;
          } catch (e) {
            const msg = e instanceof Error ? e.message : "deliverSlack failed";
            await markBlocked(
              String(row.id),
              msg,
              Number(row.attempt_count ?? 0)
            );
            processed += 1;
          }
          continue;
        }

        const channel = (p.channelId ?? install?.default_channel_id) as
          | string
          | null;

        if (install?.bot_token && row.template_key === "executive_dm_notification") {
          const changeIdDm = (p.changeEventId ?? row.change_event_id) as string;
          const slackUserId = String((p as { slackUserId?: string }).slackUserId ?? "");
          if (!slackUserId) {
            await markBlocked(String(row.id), "executive_dm_missing_slack_user", Number(row.attempt_count ?? 0));
            processed += 1;
            continue;
          }
          const execView = await buildExecutiveChangeView(admin, changeIdDm);
          if (!execView) {
            await markBlocked(String(row.id), "executive_dm_change_not_found", Number(row.attempt_count ?? 0));
            processed += 1;
            continue;
          }
          const open = (await slackApi(install.bot_token, "conversations.open", {
            users: slackUserId,
          })) as { channel?: { id?: string } };
          const dmChannel = open.channel?.id;
          if (!dmChannel) {
            await markBlocked(String(row.id), "executive_dm_open_failed", Number(row.attempt_count ?? 0));
            processed += 1;
            continue;
          }
          const overviewUrl = absoluteUrl(`/executive/changes/${changeIdDm}`);
          const interruptionReason =
            typeof p.interruptionReason === "string" && p.interruptionReason.trim().length > 0
              ? p.interruptionReason.trim()
              : null;
          const blocks = buildExecutiveDmSlackBlocks({
            view: execView,
            overviewUrl,
            orgId: String(row.org_id),
            interruptionReason,
          });
          const slackRes = await slackPostMessage({
            botToken: install.bot_token,
            channel: dmChannel,
            text: `Solvren: ${execView.title}`,
            blocks,
          });
          const slackTs = (slackRes as { ts?: string }).ts;
          if (slackTs) {
            await admin.from("notification_outbox_slack_refs").upsert(
              {
                outbox_id: row.id,
                org_id: row.org_id,
                channel_id: dmChannel,
                message_ts: slackTs,
              },
              { onConflict: "outbox_id" }
            );
          }
          const logUserId = typeof p.userId === "string" ? p.userId : null;
          const logHash = typeof p.reasonHash === "string" ? p.reasonHash : null;
          const logMaterial = p.materialSnapshot;
          const logEvent = typeof p.eventType === "string" ? p.eventType : "APPROVAL_REQUIRED";
          if (logUserId && logHash && logMaterial && typeof logMaterial === "object") {
            const routeForLog: AttentionRoutingResult = {
              userId: logUserId,
              persona: "EXECUTIVE",
              routeType:
                typeof p.routeType === "string" && ["IMMEDIATE", "DAILY_DIGEST", "WEEKLY_DIGEST", "SUPPRESS"].includes(String(p.routeType))
                  ? (p.routeType as AttentionRoutingResult["routeType"])
                  : "IMMEDIATE",
              channel: "SLACK_DM",
              deliveryTemplate:
                typeof p.deliveryTemplate === "string"
                  ? (p.deliveryTemplate as AttentionRoutingResult["deliveryTemplate"])
                  : "EXECUTIVE_ALERT",
              requiresAction: true,
              reason: interruptionReason ?? "",
              primaryReasonCode:
                typeof p.primaryReasonCode === "string"
                  ? (p.primaryReasonCode as AttentionRoutingResult["primaryReasonCode"])
                  : "ROUTINE",
            };
            try {
              await insertAttentionDeliveryLog(admin, {
                orgId: String(row.org_id),
                userId: logUserId,
                changeId: changeIdDm,
                eventType: logEvent as import("@/lib/attention/types").AttentionEventType,
                route: routeForLog,
                reasonHash: logHash,
                material: logMaterial as import("@/lib/attention/types").MaterialSnapshotV1,
                primaryReasonCode: String(p.primaryReasonCode ?? "ROUTINE"),
              });
            } catch {
              // non-fatal: table may not exist until migration applied
            }
          }
          await admin
            .from("notification_outbox")
            .update({
              status: "SENT",
              sent_at: new Date().toISOString(),
              last_error: null,
              delivered_count: 1,
            })
            .eq("id", row.id);
          processed += 1;
          continue;
        }

        if (install?.bot_token && row.template_key === "attention_digest_dm") {
          const slackUserIdDigest = String((p as { slackUserId?: string }).slackUserId ?? "");
          const digestText = String((p as { text?: string }).text ?? "Solvren attention digest");
          if (!slackUserIdDigest) {
            await markBlocked(String(row.id), "attention_digest_missing_slack_user", Number(row.attempt_count ?? 0));
            processed += 1;
            continue;
          }
          const openDigest = (await slackApi(install.bot_token, "conversations.open", {
            users: slackUserIdDigest,
          })) as { channel?: { id?: string } };
          const dmCh = openDigest.channel?.id;
          if (!dmCh) {
            await markBlocked(String(row.id), "attention_digest_open_failed", Number(row.attempt_count ?? 0));
            processed += 1;
            continue;
          }
          await slackPostMessage({
            botToken: install.bot_token,
            channel: dmCh,
            text: digestText.slice(0, 3000),
            blocks: [
              {
                type: "section",
                text: { type: "mrkdwn", text: digestText.slice(0, 2800) },
              },
            ],
          });
          await admin
            .from("notification_outbox")
            .update({
              status: "SENT",
              sent_at: new Date().toISOString(),
              last_error: null,
              delivered_count: 1,
            })
            .eq("id", row.id);
          processed += 1;
          continue;
        }

        if (install?.bot_token && channel) {
          if (row.template_key === "daily_inbox") {
            const payload = p as Record<string, unknown>;
            const dateLabel = String(payload.dateKey ?? "");
            const s = (payload.summary ?? {}) as Record<string, unknown>;
            const summaryLine =
              `*${Number(s.highRiskCount ?? 0)}* high-risk • ` +
              `*${Number(s.overdueCount ?? 0)}* overdue • ` +
              `*${Number(s.escalatedCount ?? 0)}* escalated`;

            const itemsRaw = Array.isArray(payload.items) ? payload.items : [];
            const blocks = buildDailyInboxBlocks({
              dateLabel,
              summaryLine,
              items: itemsRaw.map((it: Record<string, unknown>) => {
                const changeEventId = String(it.changeEventId ?? "");
                const approvalId = it.pendingApprovalId
                  ? String(it.pendingApprovalId)
                  : null;

                const approveAction =
                  approvalId
                    ? {
                        orgId: String(row.org_id),
                        changeEventId,
                        approvalId,
                        outboxId: String(row.id),
                      }
                    : undefined;

                const changeUrl = changeEventId
                  ? absoluteUrl(`/changes/${changeEventId}`)
                  : absoluteUrl("/dashboard");

                return {
                  title:
                    String(it.title ?? "") ||
                    (changeEventId ? `Change ${changeEventId}` : "Change"),
                  riskBucket: it.riskBucket ? String(it.riskBucket) : null,
                  metaLine: it.dueAt ? `Due: ${String(it.dueAt)}` : undefined,
                  changeUrl,
                  approveAction,
                  rejectAction: approveAction,
                };
              }),
            });

            const slackRes = await slackPostMessage({
              botToken: install.bot_token,
              channel,
              text: "Revenue Risk Inbox",
              blocks,
            });
            const slackTs = (slackRes as { ts?: string }).ts;
            if (slackTs) {
              await admin.from("notification_outbox_slack_refs").upsert(
                {
                  outbox_id: row.id,
                  org_id: row.org_id,
                  channel_id: channel,
                  message_ts: slackTs,
                },
                { onConflict: "outbox_id" }
              );
            }
            const { error: sentErr } = await admin
              .from("notification_outbox")
              .update({
                status: "SENT",
                sent_at: new Date().toISOString(),
                last_error: null,
                delivered_count: 1,
              })
              .eq("id", row.id);
            if (sentErr) throw new Error(sentErr.message);
            processed += 1;
            continue;
          }

          if (row.template_key === "weekly_digest") {
            const payload = p as Record<string, unknown>;
            const blocks = Array.isArray(payload.blocks)
              ? (payload.blocks as Record<string, unknown>[])
              : buildWeeklyDigestBlocks({
                  rangeLabel: String(payload.rangeLabel ?? "Last 7 days"),
                  summaryLine: String(
                    payload.summaryLine ??
                      "Weekly summary of risk + SLA exceptions."
                  ),
                  sections: Array.isArray(payload.sections)
                    ? payload.sections
                    : [],
                });

            const slackRes = await slackPostMessage({
              botToken: install.bot_token,
              channel,
              text:
                typeof payload.revenueAtRisk7d === "number"
                  ? `Weekly Revenue Risk Digest — $${Number(payload.revenueAtRisk7d).toLocaleString()} at risk`
                  : "Weekly Risk Digest",
              blocks,
            });

            const slackTs = (slackRes as { ts?: string }).ts;
            if (slackTs) {
              await admin.from("notification_outbox_slack_refs").upsert(
                {
                  outbox_id: row.id,
                  org_id: row.org_id,
                  channel_id: channel,
                  message_ts: slackTs,
                },
                { onConflict: "outbox_id" }
              );
            }

            const { error: sentErr } = await admin
              .from("notification_outbox")
              .update({
                status: "SENT",
                sent_at: new Date().toISOString(),
                last_error: null,
                delivered_count: 1,
              })
              .eq("id", row.id);
            if (sentErr) throw new Error(sentErr.message);
            processed += 1;
            continue;
          }

          const changeId = (p.changeEventId ?? row.change_event_id) as string;
          const title = (p.title ?? changeId) as string;

          const isApprovalRequested = row.template_key === "approval_requested";
          const isPhase5Prediction = row.template_key === "predicted_risk_early_warning";

          if (!isApprovalRequested) {
            let blocks: unknown[] = [
              {
                type: "section",
                text: { type: "mrkdwn", text: `*${rendered.title}*\n${rendered.body}` },
              },
              {
                type: "actions",
                elements: [
                  {
                    type: "button",
                    text: { type: "plain_text", text: rendered.cta_label },
                    url: absoluteUrl(rendered.cta_url),
                  },
                ],
              },
            ];
            if (isPhase5Prediction) {
              const { data: rcRel } = await admin
                .from("release_changes")
                .select("release_id")
                .eq("change_event_id", changeId)
                .maybeSingle();
              const releaseId =
                rcRel && typeof (rcRel as { release_id?: string }).release_id === "string"
                  ? (rcRel as { release_id: string }).release_id
                  : null;
              const predType = String(p.predictionType ?? "");
              const extra = predType
                ? `\n*Prediction type:* ${predType.replace(/_/g, " ")}`
                : "";
              blocks = buildPhase5PredictionSlackBlocks({
                title: rendered.title,
                bodyMd: `${rendered.body}${extra}`,
                changeUrl: absoluteUrl(`/changes/${changeId}`),
                orgId,
                changeEventId: changeId,
                predictionType: predType,
                releaseId,
              });
            }
            const slackRes = await slackPostMessage({
              botToken: install.bot_token,
              channel,
              text: rendered.title,
              blocks: blocks as Record<string, unknown>[],
            });
            const slackTs = (slackRes as { ts?: string }).ts;
            if (slackTs) {
              await admin.from("notification_outbox_slack_refs").upsert(
                { outbox_id: row.id, org_id: row.org_id, channel_id: channel, message_ts: slackTs },
                { onConflict: "outbox_id" }
              );
            }
            await admin
              .from("notification_outbox")
              .update({ status: "SENT", sent_at: new Date().toISOString(), last_error: null, delivered_count: 1 })
              .eq("id", row.id);
            processed += 1;
            continue;
          }

          const text = `Approval requested: Change ${changeId}`;

          const [{ data: approval }, { data: change }, { data: signals }] =
            await Promise.all([
              admin
                .from("approvals")
                .select("id")
                .eq("org_id", row.org_id)
                .eq("change_event_id", changeId)
                .eq("decision", "PENDING")
                .order("created_at", { ascending: true })
                .limit(1)
                .maybeSingle(),
              admin
                .from("change_events")
                .select(
                  "revenue_at_risk, revenue_exposure_multiplier, revenue_surface, domain, estimated_mrr_affected, percent_customer_base_affected, revenue_risk_score"
                )
                .eq("id", changeId)
                .maybeSingle(),
              admin
                .from("risk_signals")
                .select("signal_key")
                .eq("change_event_id", changeId),
            ]);

          const approvalId = approval?.id;
          const outboxId = row.id as string;

          const signalKeys = Array.from(
            new Set((signals ?? []).map((s) => s.signal_key).filter(Boolean))
          ) as string[];
          const mitigations =
            signalKeys.length > 0
              ? await fetchMitigationsForSignals(admin, {
                  orgId: String(row.org_id),
                  domain: (change?.domain ?? "REVENUE") as string,
                  signalKeys,
                })
              : [];

          const blocks = approvalId
            ? buildApprovalNeededBlocks({
                title,
                riskBucket: p.risk_bucket
                  ? String(p.risk_bucket)
                  : null,
                changeUrl: absoluteUrl(`/changes/${changeId}`),
                orgId: orgId,
                changeEventId: changeId,
                approvalId,
                outboxId,
                revenueAtRisk:
                  change?.revenue_at_risk != null
                    ? Number(change.revenue_at_risk)
                    : null,
                exposureMultiplier:
                  change?.revenue_exposure_multiplier != null
                    ? Number(change.revenue_exposure_multiplier)
                    : null,
                revenueSurface: change?.revenue_surface ?? null,
                estimatedMrrAffected: change?.estimated_mrr_affected ?? null,
                percentCustomerBaseAffected: change?.percent_customer_base_affected ?? null,
                revenueRiskScore: change?.revenue_risk_score != null ? Number(change.revenue_risk_score) : null,
                mitigations: mitigations.map((m) => ({
                  recommendation: m.recommendation,
                })),
              })
            : [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text:
                      `*Approval requested*\n` +
                      `Change: *${title}*\n` +
                      (p.risk_bucket
                        ? `Risk: *${String(p.risk_bucket)}*\n`
                        : ""),
                  },
                },
                {
                  type: "actions",
                  elements: [
                    {
                      type: "button",
                      text: { type: "plain_text", text: "View" },
                      url: absoluteUrl(`/changes/${changeId}`),
                    },
                  ],
                },
              ];
          const slackRes = await slackPostMessage({
            botToken: install.bot_token,
            channel,
            text,
            blocks,
          });
          const slackTs = (slackRes as { ts?: string }).ts;
          if (slackTs) {
            await admin.from("notification_outbox_slack_refs").upsert(
              {
                outbox_id: row.id,
                org_id: row.org_id,
                channel_id: channel,
                message_ts: slackTs,
              },
              { onConflict: "outbox_id" }
            );
          }
          const { error: sentErr } = await admin
            .from("notification_outbox")
            .update({
              status: "SENT",
              sent_at: new Date().toISOString(),
              last_error: null,
              delivered_count: 1,
            })
            .eq("id", row.id);
          if (sentErr) throw new Error(sentErr.message);
          processed += 1;
          continue;
        } else {
          const webhook = settings.slack_webhook_url;
          if (!webhook) throw new Error("Slack webhook or app missing for org");
          await sendSlack(
            webhook,
            rendered.title,
            rendered.body,
            rendered.cta_label,
            rendered.cta_url
          );
        }
      } else if (row.channel === "EMAIL") {
        if (!settings.email_enabled) {
          await markBlocked(
            String(row.id),
            "blocked_email_disabled_in_settings",
            Number(row.attempt_count ?? 0)
          );
          processed += 1;
          continue;
        }

        const digest = isWeeklyDigest(String(row.template_key ?? ""));
        if (digest) {
          if (!canUseWeeklyDigest(planFromString(plan_key), status)) {
            await markBlocked(
              String(row.id),
              "blocked_plan_not_entitled_for_weekly_digest",
              Number(row.attempt_count ?? 0)
            );
            processed += 1;
            continue;
          }
        } else {
          if (!ALLOW_NON_DIGEST_EMAIL_ON_FREE && plan_key === "FREE") {
            await markBlocked(
              String(row.id),
              "blocked_plan_not_entitled_for_email_alerts",
              Number(row.attempt_count ?? 0)
            );
            processed += 1;
            continue;
          }
        }

        const pEmail = (row.payload ?? {}) as Record<string, unknown>;
        const overrideRecipients = Array.isArray(pEmail.recipients)
          ? (pEmail.recipients as string[])
          : null;
        const emails =
          overrideRecipients && overrideRecipients.length > 0
            ? overrideRecipients
            : (settings.notification_emails ?? []);
        if (!emails || emails.length === 0)
          throw new Error("notification_emails not configured for org");

        const digestWithRevenue =
          isWeeklyDigest(String(row.template_key ?? "")) &&
          typeof pEmail.emailSubject === "string" &&
          typeof pEmail.emailText === "string";
        const subject = digestWithRevenue
          ? (pEmail.emailSubject as string)
          : rendered.title;
        const body = digestWithRevenue
          ? (pEmail.emailText as string)
          : rendered.body;
        const ctaLabel = digestWithRevenue ? "Open dashboard" : rendered.cta_label;
        const ctaUrl = digestWithRevenue ? "/dashboard" : rendered.cta_url;

        await sendEmail(emails, subject, body, ctaLabel, ctaUrl);
      } else {
        throw new Error(`Unsupported channel: ${row.channel}`);
      }

      const { error: sentErr } = await admin
        .from("notification_outbox")
        .update({
          status: "SENT",
          sent_at: new Date().toISOString(),
          last_error: null,
          delivered_count: 1,
        })
        .eq("id", row.id);

      if (sentErr) throw new Error(sentErr.message);

      processed += 1;
    } catch (e) {
      const attempts = Number(row.attempt_count ?? 0) + 1;
      const failStatus = attempts >= MAX_ATTEMPTS ? "FAILED" : "PENDING";
      const errMsg = e instanceof Error ? e.message : "Unknown error";
      if (failStatus === "FAILED") {
        errors += 1;
        logError("notifications.process.delivery_failed", new Error(errMsg), {
          outboxId: row.id,
          template_key: row.template_key,
          channel: row.channel,
          attempts,
        });
      }

      await admin
        .from("notification_outbox")
        .update({
          status: failStatus,
          attempt_count: attempts,
          last_error: errMsg,
          available_at:
            failStatus === "PENDING"
              ? nextAvailableAt(attempts)
              : new Date().toISOString(),
        })
        .eq("id", row.id);

      processed += 1;
    }
  }

  logInfo("notifications.process.completed", {
    processed,
    errors,
  });

  return NextResponse.json({
    ok: true,
    processed,
    errors,
  });
}
