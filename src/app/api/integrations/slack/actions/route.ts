import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySlackRequest } from "@/services/slack/verifySlack";
import { env } from "@/lib/env";
import { submitChangeFromSlack } from "@/services/slack/submitChangeFromSlack";
import {
  buildApprovalRequestedBlocks,
  buildApprovalActionButtons,
  buildThreadUpdateText,
  buildDecisionStateBlocks,
} from "@/services/slack/blockBuilders";
import { enqueueSlack } from "@/services/notifications/enqueueSlack";
import { fetchMitigationsForSignals } from "@/services/risk/mitigationsDb";

type SlackInteractivePayload = {
  type?: string;
  callback_id?: string;
  trigger_id?: string;
  user?: { id: string };
  team?: { id: string };
  channel?: { id: string };
  message?: { ts: string };
  actions?: Array<{ action_id: string; value?: string }>;
  view?: {
    callback_id?: string;
    state?: { values?: Record<string, Record<string, { value?: string | { value?: string }; selected_option?: { value?: string } }>> };
  };
};

type ButtonValue = {
  orgId?: string;
  changeEventId?: string;
  approvalId: string;
  outboxId?: string;
};

function pickModalValue(view: { state?: { values?: Record<string, Record<string, { value?: string; selected_option?: { value?: string } }>> } }, blockId: string): string | null {
  const block = view?.state?.values?.[blockId];
  if (!block) return null;
  const firstKey = Object.keys(block)[0];
  const el = block[firstKey];
  if (!el) return null;
  if (typeof el.value === "string") return el.value;
  if (el.selected_option?.value) return el.selected_option.value;
  return null;
}

async function slackApi(botToken: string, method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok?: boolean; error?: string; channel?: { id?: string }; ts?: string };
  if (!json?.ok) throw new Error(json?.error ?? `Slack API error: ${method}`);
  return json;
}

function absoluteUrl(path: string) {
  return path.startsWith("http") ? path : `${env.appUrl}${path}`;
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signingSecret = env.slackSigningSecret;
  if (!signingSecret) throw new Error("Missing SLACK_SIGNING_SECRET");

  if (
    !verifySlackRequest({
      rawBody,
      timestamp: req.headers.get("x-slack-request-timestamp"),
      signature: req.headers.get("x-slack-signature"),
      signingSecret,
    })
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const form = new URLSearchParams(rawBody);
  const payloadStr = form.get("payload");
  if (!payloadStr)
    return NextResponse.json({ error: "Missing payload" }, { status: 400 });

  let payload: SlackInteractivePayload;
  try {
    payload = JSON.parse(payloadStr);
  } catch {
    return NextResponse.json({ error: "Bad payload JSON" }, { status: 400 });
  }

  const slackUserId = payload.user?.id;
  const teamId = payload.team?.id ?? "unknown";

  // ——— Shortcut: open Submit Change modal ———
  if (payload.type === "shortcut" && payload.callback_id === "submit_change_shortcut") {
    if (!payload.trigger_id || !slackUserId || !teamId) {
      return NextResponse.json({ error: "Missing trigger_id or user" }, { status: 400 });
    }
    const admin = createAdminClient();
    const { data: install } = await admin
      .from("slack_installations")
      .select("bot_token, org_id")
      .eq("team_id", teamId)
      .eq("status", "ACTIVE")
      .maybeSingle();
    if (!install?.bot_token) {
      return NextResponse.json({ error: "Slack app not installed for this workspace" }, { status: 400 });
    }
    const orgId = install.org_id as string;
    const surfaceOptions = [
      "PRICING", "BILLING", "PAYMENTS", "SUBSCRIPTIONS", "ENTITLEMENTS",
      "CHECKOUT", "TAX", "PROMOTIONS", "INVOICING", "OTHER",
    ];
    const view = {
      type: "modal",
      callback_id: "submit_change_modal",
      private_metadata: JSON.stringify({ orgId }),
      title: { type: "plain_text", text: "Submit Change" },
      submit: { type: "plain_text", text: "Submit" },
      close: { type: "plain_text", text: "Cancel" },
      blocks: [
        {
          type: "input",
          block_id: "title",
          label: { type: "plain_text", text: "Title" },
          element: { type: "plain_text_input", action_id: "value" },
        },
        {
          type: "input",
          block_id: "desc",
          optional: true,
          label: { type: "plain_text", text: "Description" },
          element: { type: "plain_text_input", action_id: "value", multiline: true },
        },
        {
          type: "input",
          block_id: "mrr",
          optional: true,
          label: { type: "plain_text", text: "Estimated MRR affected (USD)" },
          element: {
            type: "plain_text_input",
            action_id: "value",
            placeholder: { type: "plain_text", text: "e.g. 25000" },
          },
        },
        {
          type: "input",
          block_id: "pct",
          optional: true,
          label: { type: "plain_text", text: "% customer base affected" },
          element: {
            type: "plain_text_input",
            action_id: "value",
            placeholder: { type: "plain_text", text: "0–100" },
          },
        },
        {
          type: "input",
          block_id: "surface",
          optional: true,
          label: { type: "plain_text", text: "Revenue surface" },
          element: {
            type: "static_select",
            action_id: "value",
            placeholder: { type: "plain_text", text: "Select..." },
            options: surfaceOptions.map((s) => ({
              text: { type: "plain_text", text: s },
              value: s,
            })),
          },
        },
      ],
    };
    const res = await fetch("https://slack.com/api/views.open", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${install.bot_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trigger_id: payload.trigger_id, view }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    if (!json?.ok) {
      return NextResponse.json({ error: json?.error ?? "Failed to open modal" }, { status: 500 });
    }
    return new Response(null, { status: 200 });
  }

  // ——— View submission: Add comment modal ———
  if (
    payload.type === "view_submission" &&
    payload.view?.callback_id === "approval_comment_modal"
  ) {
    try {
      const rawMeta = (payload.view as { private_metadata?: string } | undefined)?.private_metadata;
      const meta = rawMeta ? (JSON.parse(rawMeta) as { approvalId?: string }) : {};
      const approvalIdMeta = meta.approvalId as string | undefined;
      if (!approvalIdMeta) throw new Error("Missing approvalId");

      const comment =
        pickModalValue(payload.view as Parameters<typeof pickModalValue>[0], "comment")?.trim() || null;

      const admin = createAdminClient();
      const { data: approval, error: apErr } = await admin
        .from("approvals")
        .select("id, org_id, change_event_id")
        .eq("id", approvalIdMeta)
        .maybeSingle();

      if (apErr) throw new Error(apErr.message);
      if (!approval) throw new Error("Approval not found");

      const changeId = approval.change_event_id as string;

      const { error: updErr } = await admin
        .from("approvals")
        .update({ comment })
        .eq("id", approvalIdMeta);

      if (updErr) throw new Error(updErr.message);

      const { data: change } = await admin
        .from("change_events")
        .select(
          "id, title, revenue_at_risk, slack_channel_id, slack_message_ts"
        )
        .eq("id", changeId)
        .maybeSingle();

      const changeUrl = absoluteUrl(`/changes/${changeId}`);
      const channel = (change as { slack_channel_id?: string })?.slack_channel_id;
      const ts = (change as { slack_message_ts?: string })?.slack_message_ts;

      if (channel && ts) {
        await enqueueSlack(admin, {
          orgId: approval.org_id as string,
          kind: "approval_comment",
          dedupeKey: `approval_comment:${approvalIdMeta}:${Buffer.from(comment ?? "").toString("base64").slice(0, 16)}`,
          method: "chat.postMessage",
          methodArgs: {
            channel,
            thread_ts: ts,
            text: `💬 Comment added${comment ? `:\n>${comment}` : "."}\n<${changeUrl}|Open change>`,
          },
        });
      }

      return new Response(
        JSON.stringify({ response_action: "clear" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save comment";
      return NextResponse.json({
        response_action: "errors",
        errors: { comment: msg },
      });
    }
  }

  // ——— View submission: create change + post approval message ———
  if (payload.type === "view_submission" && payload.view?.callback_id === "submit_change_modal") {
    try {
      const rawMeta2 = (payload.view as { private_metadata?: string } | undefined)?.private_metadata;
      const meta = rawMeta2 ? (JSON.parse(rawMeta2) as { orgId?: string }) : {};
      let orgId = meta.orgId;
      if (!orgId && teamId) {
        const admin = createAdminClient();
        const { data: install } = await admin
          .from("slack_installations")
          .select("org_id")
          .eq("team_id", teamId)
          .eq("status", "ACTIVE")
          .maybeSingle();
        orgId = install?.org_id as string | undefined;
      }
      if (!orgId) throw new Error("Missing org context");
      if (!slackUserId) throw new Error("Missing user");

      const admin = createAdminClient();
      const { data: mapped } = await admin
        .from("slack_user_map")
        .select("user_id")
        .eq("org_id", orgId)
        .eq("slack_user_id", slackUserId)
        .maybeSingle();

      const actorUserId = mapped?.user_id ?? null;
      if (!actorUserId) {
        const linkUrl = absoluteUrl("/org/settings");
        return NextResponse.json({
          response_action: "errors",
          errors: {
            title: `Your Slack user isn't linked. <${linkUrl}|Link Slack in the app> to submit changes.`,
          },
        });
      }

      const view = payload.view as Parameters<typeof pickModalValue>[0];
      const title = pickModalValue(view, "title")?.trim();
      if (!title) {
        return NextResponse.json({
          response_action: "errors",
          errors: { title: "Title is required." },
        });
      }

      const description = pickModalValue(view, "desc")?.trim() || null;
      const mrrRaw = pickModalValue(view, "mrr");
      const pctRaw = pickModalValue(view, "pct");
      const surface = pickModalValue(view, "surface") || null;

      const estimatedMrrAffected =
        mrrRaw && String(mrrRaw).trim() !== ""
          ? Number(mrrRaw)
          : null;
      const percentCustomerBaseAffected =
        pctRaw && String(pctRaw).trim() !== ""
          ? Number(pctRaw)
          : null;

      if (
        percentCustomerBaseAffected != null &&
        (percentCustomerBaseAffected < 0 || percentCustomerBaseAffected > 100)
      ) {
        return NextResponse.json({
          response_action: "errors",
          errors: { pct: "Must be between 0 and 100" },
        });
      }
      if (estimatedMrrAffected != null && estimatedMrrAffected < 0) {
        return NextResponse.json({
          response_action: "errors",
          errors: { mrr: "Must be >= 0" },
        });
      }

      const { change, approvalId } = await submitChangeFromSlack(admin, {
        orgId,
        actorUserId,
        title,
        description,
        estimatedMrrAffected,
        percentCustomerBaseAffected,
        revenueSurface: surface,
      });

      const changeUrl = absoluteUrl(`/changes/${change.id}`);

      type MitigationBlock = { recommendation: string; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" };
      let mitigations: MitigationBlock[] = [];
      try {
        const { data: signals } = await admin
          .from("risk_signals")
          .select("signal_key")
          .eq("change_event_id", change.id);
        const signalKeys = Array.from(
          new Set((signals ?? []).map((s) => s.signal_key).filter(Boolean))
        ) as string[];
        if (signalKeys.length > 0) {
          const ms = await fetchMitigationsForSignals(admin, {
            orgId,
            domain: (change.domain ?? "REVENUE") as string,
            signalKeys,
          });
          mitigations = ms.map((m) => ({
            recommendation: m.recommendation,
            severity: m.severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
          }));
        }
      } catch {
        mitigations = [];
      }

      const { data: install } = await admin
        .from("slack_installations")
        .select("bot_token")
        .eq("org_id", orgId)
        .eq("status", "ACTIVE")
        .maybeSingle();

      if (!install?.bot_token) throw new Error("Slack app not active");

      const blocks = buildApprovalRequestedBlocks({
        title: (change.title as string) ?? title,
        changeUrl,
        riskScore: Number(change.risk_score ?? 0),
        revenueAtRisk: Number(change.revenue_at_risk ?? 0),
        exposureMultiplier: Number(change.revenue_exposure_multiplier ?? 1),
        revenueSurface: (change.revenue_surface as string) ?? surface,
        estimatedMrrAffected: (change as { estimated_mrr_affected?: number | null }).estimated_mrr_affected ?? estimatedMrrAffected ?? null,
        percentCustomerBaseAffected: (change as { percent_customer_base_affected?: number | null }).percent_customer_base_affected ?? percentCustomerBaseAffected ?? null,
        revenueRiskScore: (change as { revenue_risk_score?: number | null }).revenue_risk_score != null ? Number((change as { revenue_risk_score: number }).revenue_risk_score) : null,
        dueAt: (change.due_at as string) ?? null,
        mitigations,
      });

      const fullValue = JSON.stringify({
        orgId,
        changeEventId: change.id,
        approvalId: approvalId ?? "",
        outboxId: "",
      });
      if (approvalId) {
        blocks.push(
          ...buildApprovalActionButtons({
            approvalId,
            fullValue,
            changeUrl,
          })
        );
      } else {
        blocks.push({
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Open" },
              url: changeUrl,
            },
          ],
        });
      }

      const channelId = payload.channel?.id;
      const targetChannel = channelId
        ? channelId
        : ((await slackApi(install.bot_token, "conversations.open", {
            users: slackUserId,
          })) as { channel?: { id?: string } }).channel?.id;

      if (!targetChannel) throw new Error("Could not resolve target channel");

      const domainKey = (change.domain ?? "REVENUE") as string;
      await enqueueSlack(admin, {
        orgId,
        kind: "approval_requested",
        dedupeKey: `approval_requested:${orgId}:${domainKey}:${change.id}`,
        method: "chat.postMessage",
        methodArgs: {
          channel: targetChannel,
          text: `Approval requested: ${title}`,
          blocks,
        },
        meta: { changeId: change.id },
        changeEventId: change.id,
      });

      return new Response(
        JSON.stringify({ response_action: "clear" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to submit change";
      return NextResponse.json({
        response_action: "errors",
        errors: { title: msg },
      });
    }
  }

  // ——— Block actions: approval buttons ———
  const action = payload.actions?.[0];
  const channelId = payload.channel?.id;
  const messageTs = payload.message?.ts;

  if (!action || !slackUserId) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  let value: ButtonValue;
  try {
    const parsed = JSON.parse(action.value ?? "{}");
    value =
      typeof parsed === "object" && parsed?.approvalId
        ? parsed
        : { approvalId: String(action.value ?? "") };
  } catch {
    value = { approvalId: String(action.value ?? "") };
  }

  const approvalId = value.approvalId;
  if (!approvalId) {
    return NextResponse.json(
      { error: "Missing approvalId in action value" },
      { status: 400 }
    );
  }

  // approval_comment: open Add comment modal (direct, not via outbox)
  if (action.action_id === "approval_comment") {
    const triggerId = payload.trigger_id;
    if (!triggerId) return NextResponse.json({ ok: true });
    const admin = createAdminClient();
    const { data: approvalRow } = await admin
      .from("approvals")
      .select("org_id")
      .eq("id", approvalId)
      .maybeSingle();
    if (!approvalRow) return NextResponse.json({ ok: true });
    const { data: install } = await admin
      .from("slack_installations")
      .select("bot_token")
      .eq("org_id", approvalRow.org_id)
      .eq("status", "ACTIVE")
      .maybeSingle();
    if (!install?.bot_token) return NextResponse.json({ ok: true });
    await slackApi(install.bot_token, "views.open", {
      trigger_id: triggerId,
      view: {
        type: "modal",
        callback_id: "approval_comment_modal",
        private_metadata: JSON.stringify({ approvalId }),
        title: { type: "plain_text", text: "Add Comment" },
        submit: { type: "plain_text", text: "Save" },
        close: { type: "plain_text", text: "Cancel" },
        blocks: [
          {
            type: "input",
            block_id: "comment",
            label: { type: "plain_text", text: "Comment" },
            element: {
              type: "plain_text_input",
              action_id: "value",
              multiline: true,
            },
          },
        ],
      },
    });
    return NextResponse.json({ ok: true });
  }

  // approval_open: return ephemeral with change URL
  if (action.action_id === "approval_open") {
    const admin = createAdminClient();
    const { data: approval } = await admin
      .from("approvals")
      .select("change_event_id")
      .eq("id", approvalId)
      .maybeSingle();
    const changeId = approval?.change_event_id as string | undefined;
    const changeUrl = changeId ? absoluteUrl(`/changes/${changeId}`) : absoluteUrl("/dashboard");
    return NextResponse.json({
      response_type: "ephemeral",
      text: changeId ? `Open: ${changeUrl}` : "Change not found.",
    });
  }

  if (
    action.action_id !== "approval_approve" &&
    action.action_id !== "approval_reject"
  ) {
    return NextResponse.json({ ok: true });
  }

  if (!channelId || !messageTs) {
    return NextResponse.json(
      { error: "Missing channel or message context" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Resolve orgId, changeEventId from approval if not in value
  let orgId = value.orgId;
  let changeEventId = value.changeEventId;
  if (!orgId || !changeEventId) {
    const { data: approvalRow } = await admin
      .from("approvals")
      .select("org_id, change_event_id")
      .eq("id", approvalId)
      .maybeSingle();
    if (!approvalRow) {
      return NextResponse.json({
        response_type: "ephemeral",
        text: "Approval not found.",
      });
    }
    orgId = orgId ?? (approvalRow.org_id as string);
    changeEventId = changeEventId ?? (approvalRow.change_event_id as string);
  }
  const outboxId = value.outboxId;

  const dedupeKey = `slack:${teamId}:${slackUserId}:${channelId}:${messageTs}:${action.action_id}`;
  const { error: dedupeErr } = await admin.from("slack_action_events").insert({
    org_id: orgId,
    dedupe_key: dedupeKey,
    slack_team_id: teamId,
    slack_user_id: slackUserId,
    action_id: action.action_id,
    channel_id: channelId,
    message_ts: messageTs,
    payload: payload as unknown as Record<string, unknown>,
  });

  if (
    dedupeErr &&
    /duplicate key value violates unique constraint/i.test(dedupeErr.message)
  ) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "Already processed.",
    });
  }
  if (dedupeErr) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "Unable to process action. Try again.",
    });
  }

  const { data: mapped } = await admin
    .from("slack_user_map")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("slack_user_id", slackUserId)
    .maybeSingle();

  const mappedUserId = mapped?.user_id ?? null;
  if (!mappedUserId) {
    const linkUrl = absoluteUrl("/org/settings");
    return NextResponse.json({
      response_type: "ephemeral",
      text: `Your Slack user isn't linked to an approver account. <${linkUrl}|Link Slack in the app> to enable one-click approvals.`,
    });
  }

  const { data: approval } = await admin
    .from("approvals")
    .select("id, approver_user_id, decision")
    .eq("id", approvalId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!approval) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "Approval not found.",
    });
  }
  if (approval.approver_user_id !== mappedUserId) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "You are not the assigned approver for this item.",
    });
  }
  if (approval.decision !== "PENDING") {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "This approval has already been decided.",
    });
  }

  const decision =
    action.action_id === "approval_approve" ? "APPROVED" : "REJECTED";

  const { error: updErr } = await admin
    .from("approvals")
    .update({ decision, decided_at: new Date().toISOString() })
    .eq("id", approvalId)
    .eq("org_id", orgId);

  if (updErr) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "Failed to save decision. Please try again.",
    });
  }

  const [
    { data: slackRef },
    { data: change },
    { data: assessment },
    { data: pendingApprovals },
  ] = await Promise.all([
    outboxId
      ? admin
          .from("notification_outbox_slack_refs")
          .select("channel_id, message_ts")
          .eq("outbox_id", outboxId)
          .eq("org_id", orgId)
          .maybeSingle()
      : { data: null },
    admin
      .from("change_events")
      .select(
        "title, revenue_at_risk, revenue_exposure_multiplier, revenue_surface, slack_channel_id, slack_message_ts"
      )
      .eq("id", changeEventId)
      .maybeSingle(),
    admin
      .from("impact_assessments")
      .select("risk_score_raw")
      .eq("change_event_id", changeEventId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("approvals")
      .select("id")
      .eq("change_event_id", changeEventId)
      .eq("org_id", orgId)
      .eq("decision", "PENDING"),
  ]);

  const threadChannel =
    slackRef?.channel_id ??
    (change as { slack_channel_id?: string })?.slack_channel_id ??
    null;
  const threadTs =
    slackRef?.message_ts ??
    (change as { slack_message_ts?: string })?.slack_message_ts ??
    null;

  if (threadChannel && threadTs) {
    const remainingCount = (pendingApprovals ?? []).length;
    const revenueAtRisk =
      change?.revenue_at_risk != null
        ? Number(change.revenue_at_risk)
        : null;
    const riskScore =
      assessment?.risk_score_raw != null
        ? Number(assessment.risk_score_raw)
        : 0;
    const changeUrl = absoluteUrl(`/changes/${changeEventId}`);
    const actorDisplay = `<@${slackUserId}>`;

    const decisionBlocks = buildDecisionStateBlocks({
      title: (change?.title as string) ?? "Untitled change",
      changeUrl,
      decision,
      actorName: actorDisplay,
      riskScore,
      revenueAtRisk: revenueAtRisk ?? 0,
      exposureMultiplier: Number(
        (change as { revenue_exposure_multiplier?: number })
          ?.revenue_exposure_multiplier ?? 1
      ),
      revenueSurface:
        (change as { revenue_surface?: string })?.revenue_surface ?? null,
    });

    await enqueueSlack(admin, {
      orgId,
      kind: "slack_message_update",
      dedupeKey: `slack_update_decision:${approvalId}:${decision}`,
      method: "chat.update",
      methodArgs: {
        channel: threadChannel,
        ts: threadTs,
        text: `Decision recorded: ${decision}`,
        blocks: decisionBlocks,
      },
    });

    await enqueueSlack(admin, {
      orgId,
      kind: "approval_decision",
      dedupeKey: `approval_decision_thread:${approvalId}:${decision}`,
      method: "chat.postMessage",
      methodArgs: {
        channel: threadChannel,
        thread_ts: threadTs,
        text: buildThreadUpdateText({
          actorName: actorDisplay,
          decision,
          remainingApprovals: remainingCount,
          revenueAtRisk: revenueAtRisk ?? 0,
          changeUrl,
        }),
      },
    });
  }

  return NextResponse.json({
    response_type: "ephemeral",
    text: decision === "APPROVED" ? "Approved ✅" : "Rejected ❌",
  });
}
