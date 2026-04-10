import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySlackRequest } from "@/services/slack/verifySlack";
import { env } from "@/lib/env";
import { submitChangeFromSlack } from "@/services/slack/submitChangeFromSlack";
import {
  buildApprovalRequestedBlocks,
  buildApprovalActionButtons,
} from "@/services/slack/blockBuilders";
import { enqueueSlack } from "@/services/notifications/enqueueSlack";
import { resolveSlackToSolvrenUserId, SLACK_NOT_LINKED_EPHEMERAL } from "@/lib/slack/resolveSlackUser";
import {
  parseApprovalActionValue,
  enqueueSlackInteractiveJob,
  type SlackInteractiveJobPayload,
} from "@/lib/slack/approvalActions";
import { nextTomorrowMorningNineAm } from "@/lib/slack/deferReminderAt";
import { addTimelineEvent } from "@/services/timeline/addTimelineEvent";
import { fetchMitigationsForSignals } from "@/services/risk/mitigationsDb";
import { persistExecutiveDecision } from "@/lib/executive/persistExecutiveDecision";
import { isExecutiveUserForPhase1 } from "@/lib/rbac/isExecutiveUserForPhase1";

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

  // ——— View submission: request info (Phase 4) ———
  if (
    payload.type === "view_submission" &&
    payload.view?.callback_id === "approval_request_info_modal"
  ) {
    try {
      const rawMeta = (payload.view as { private_metadata?: string } | undefined)?.private_metadata;
      const meta = rawMeta ? (JSON.parse(rawMeta) as { approvalId?: string }) : {};
      const approvalIdMeta = meta.approvalId as string | undefined;
      if (!approvalIdMeta) throw new Error("Missing approvalId");
      const question =
        pickModalValue(payload.view as Parameters<typeof pickModalValue>[0], "question")?.trim() || "";
      if (!question) throw new Error("Question is required");

      const admin = createAdminClient();
      const { data: approval, error: apErr } = await admin
        .from("approvals")
        .select("id, org_id, change_event_id, approver_user_id")
        .eq("id", approvalIdMeta)
        .maybeSingle();
      if (apErr) throw new Error(apErr.message);
      if (!approval) throw new Error("Approval not found");

      const { data: installRi } = await admin
        .from("slack_installations")
        .select("bot_token")
        .eq("org_id", approval.org_id as string)
        .eq("status", "ACTIVE")
        .maybeSingle();
      const actorId = await resolveSlackToSolvrenUserId({
        admin,
        orgId: approval.org_id as string,
        slackTeamId: teamId,
        slackUserId: slackUserId!,
        botToken: (installRi?.bot_token as string | undefined) ?? null,
      });
      if (!actorId) throw new Error(SLACK_NOT_LINKED_EPHEMERAL);

      await addTimelineEvent({
        supabase: admin,
        orgId: approval.org_id as string,
        changeEventId: approval.change_event_id as string,
        actorUserId: actorId,
        eventType: "APPROVAL_INFO_REQUESTED_FROM_SLACK",
        title: "Information requested (Slack)",
        description: question,
        metadata: { approval_id: approvalIdMeta, slack_user_id: slackUserId },
      });

      return new Response(
        JSON.stringify({ response_action: "clear" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to submit";
      return NextResponse.json({
        response_action: "errors",
        errors: { question: msg },
      });
    }
  }

  // ——— View submission: delegate (Phase 4) ———
  if (
    payload.type === "view_submission" &&
    payload.view?.callback_id === "approval_delegate_modal"
  ) {
    try {
      const rawMeta = (payload.view as { private_metadata?: string } | undefined)?.private_metadata;
      const meta = rawMeta
        ? (JSON.parse(rawMeta) as { orgId?: string; approvalId?: string })
        : {};
      if (!meta.orgId || !meta.approvalId) throw new Error("Missing context");

      const email =
        pickModalValue(payload.view as Parameters<typeof pickModalValue>[0], "delegate_email")
          ?.trim()
          .toLowerCase() ?? "";
      if (!email.includes("@")) throw new Error("Enter a valid email");

      const admin = createAdminClient();
      const { data: installDel } = await admin
        .from("slack_installations")
        .select("bot_token")
        .eq("org_id", meta.orgId)
        .eq("status", "ACTIVE")
        .maybeSingle();
      const actorId = await resolveSlackToSolvrenUserId({
        admin,
        orgId: meta.orgId,
        slackTeamId: teamId,
        slackUserId: slackUserId!,
        botToken: (installDel?.bot_token as string | undefined) ?? null,
      });
      if (!actorId) throw new Error(SLACK_NOT_LINKED_EPHEMERAL);

      const { data: targetUserIdRaw } = await admin.rpc("get_auth_user_id_by_email", {
        p_email: email,
      });
      const delegateUserId = targetUserIdRaw ? String(targetUserIdRaw) : "";
      if (!delegateUserId) throw new Error("No Solvren user with that email");

      const { data: mem } = await admin
        .from("organization_members")
        .select("user_id")
        .eq("org_id", meta.orgId)
        .eq("user_id", delegateUserId)
        .maybeSingle();
      if (!mem) throw new Error("That user is not in this organization");

      const { data: approval } = await admin
        .from("approvals")
        .select("id, org_id, change_event_id, approver_user_id, decision")
        .eq("id", meta.approvalId)
        .eq("org_id", meta.orgId)
        .maybeSingle();
      if (!approval || approval.decision !== "PENDING") throw new Error("Approval not pending");
      if (approval.approver_user_id !== actorId) throw new Error("Only the assigned approver may delegate");

      const { data: settings } = await admin
        .from("organization_settings")
        .select("allow_delegate_approval")
        .eq("org_id", meta.orgId)
        .maybeSingle();
      if (!(settings as { allow_delegate_approval?: boolean } | null)?.allow_delegate_approval) {
        throw new Error("Delegation is disabled for this organization");
      }

      const { error: upDel } = await admin
        .from("approvals")
        .update({
          delegate_user_id: delegateUserId,
          delegated_at: new Date().toISOString(),
        })
        .eq("id", meta.approvalId);
      if (upDel) throw new Error(upDel.message);

      await addTimelineEvent({
        supabase: admin,
        orgId: meta.orgId,
        changeEventId: approval.change_event_id as string,
        actorUserId: actorId,
        eventType: "APPROVAL_DELEGATED_FROM_SLACK",
        title: "Approval delegated (Slack)",
        description: `Delegated to ${email}`,
        metadata: { approval_id: meta.approvalId, delegate_user_id: delegateUserId },
      });

      return new Response(
        JSON.stringify({ response_action: "clear" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delegate";
      return NextResponse.json({
        response_action: "errors",
        errors: { delegate_email: msg },
      });
    }
  }

  // ——— View submission: defer reminder (Phase 4) ———
  if (
    payload.type === "view_submission" &&
    payload.view?.callback_id === "approval_defer_modal"
  ) {
    try {
      const rawMeta = (payload.view as { private_metadata?: string } | undefined)?.private_metadata;
      const meta = rawMeta
        ? (JSON.parse(rawMeta) as {
            orgId?: string;
            approvalId?: string;
            changeEventId?: string;
            channelId?: string;
            messageTs?: string;
            slackUserId?: string;
          })
        : {};
      if (!meta.orgId || !meta.approvalId || !meta.changeEventId) throw new Error("Missing context");

      const when =
        pickModalValue(payload.view as Parameters<typeof pickModalValue>[0], "when") ?? "tomorrow";
      const admin = createAdminClient();
      const { data: installDef } = await admin
        .from("slack_installations")
        .select("bot_token")
        .eq("org_id", meta.orgId)
        .eq("status", "ACTIVE")
        .maybeSingle();
      const actorId = await resolveSlackToSolvrenUserId({
        admin,
        orgId: meta.orgId,
        slackTeamId: teamId,
        slackUserId: slackUserId!,
        botToken: (installDef?.bot_token as string | undefined) ?? null,
      });
      if (!actorId) throw new Error(SLACK_NOT_LINKED_EPHEMERAL);

      const { data: approval } = await admin
        .from("approvals")
        .select("id, org_id, change_event_id, approver_user_id, decision")
        .eq("id", meta.approvalId)
        .eq("org_id", meta.orgId)
        .maybeSingle();
      if (!approval || approval.decision !== "PENDING") throw new Error("Approval not pending");
      if (approval.approver_user_id !== actorId) throw new Error("Only the assigned approver may defer");

      const { data: orgTzRow } = await admin
        .from("organization_settings")
        .select("timezone")
        .eq("org_id", meta.orgId)
        .maybeSingle();
      const orgTz = (orgTzRow as { timezone?: string | null } | null)?.timezone ?? "UTC";

      const reminderAt =
        when === "24h"
          ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          : nextTomorrowMorningNineAm(orgTz).toISOString();

      const { error: insDef } = await admin.from("slack_deferred_actions").insert({
        org_id: meta.orgId,
        user_id: actorId,
        change_event_id: meta.changeEventId,
        approval_id: meta.approvalId,
        reminder_at: reminderAt,
        reminder_type: "defer",
        slack_channel_id: meta.channelId ?? null,
        slack_message_ts: meta.messageTs ?? null,
        payload_json: {
          source: "slack_deferred_actions",
          slack_user_id: meta.slackUserId ?? slackUserId,
        },
      });
      if (insDef) throw new Error(insDef.message);

      await addTimelineEvent({
        supabase: admin,
        orgId: meta.orgId,
        changeEventId: meta.changeEventId,
        actorUserId: actorId,
        eventType: "APPROVAL_DEFERRED_FROM_SLACK",
        title: "Approval reminder deferred (Slack)",
        description: when === "24h" ? "Reminder in 24 hours" : "Reminder tomorrow morning",
        metadata: { approval_id: meta.approvalId, reminder_at: reminderAt },
      });

      return new Response(
        JSON.stringify({ response_action: "clear" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to defer";
      return NextResponse.json({
        response_action: "errors",
        errors: { when: msg },
      });
    }
  }

  // ——— View submission: executive DM decision ———
  if (
    payload.type === "view_submission" &&
    payload.view?.callback_id === "executive_decision_modal"
  ) {
    try {
      const rawMeta = (payload.view as { private_metadata?: string } | undefined)?.private_metadata;
      const meta = rawMeta
        ? (JSON.parse(rawMeta) as { orgId?: string; changeId?: string; decision?: string })
        : {};
      if (!meta.orgId || !meta.changeId || !meta.decision) throw new Error("Missing context");
      if (!slackUserId) throw new Error("Missing Slack user");

      const comment =
        pickModalValue(payload.view as Parameters<typeof pickModalValue>[0], "comment")?.trim() || "";

      const admin = createAdminClient();
      const { data: installExec } = await admin
        .from("slack_installations")
        .select("bot_token")
        .eq("org_id", meta.orgId)
        .eq("status", "ACTIVE")
        .maybeSingle();
      const userId = await resolveSlackToSolvrenUserId({
        admin,
        orgId: meta.orgId,
        slackTeamId: teamId,
        slackUserId: slackUserId!,
        botToken: (installExec?.bot_token as string | undefined) ?? null,
      });
      if (!userId) {
        return NextResponse.json({
          response_action: "errors",
          errors: {
            comment: SLACK_NOT_LINKED_EPHEMERAL,
          },
        });
      }

      const execOk = await isExecutiveUserForPhase1(admin, userId, meta.orgId);
      if (!execOk) throw new Error("Not authorized for executive actions");

      const decision = meta.decision === "DELAY" ? "DELAY" : "APPROVE";
      const result = await persistExecutiveDecision(admin, {
        orgId: meta.orgId,
        changeId: meta.changeId,
        userId,
        decision,
        comment: comment || null,
      });

      if (!result.ok) {
        const reasons = (result.body.reasons as string[] | undefined)?.join("; ") ?? String(result.body.error ?? "Failed");
        return NextResponse.json({
          response_action: "errors",
          errors: { comment: reasons },
        });
      }

      return new Response(
        JSON.stringify({ response_action: "clear" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save";
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
      const { data: installSubmit } = await admin
        .from("slack_installations")
        .select("bot_token")
        .eq("org_id", orgId)
        .eq("status", "ACTIVE")
        .maybeSingle();

      const actorUserId = await resolveSlackToSolvrenUserId({
        admin,
        orgId,
        slackTeamId: teamId,
        slackUserId: slackUserId!,
        botToken: (installSubmit?.bot_token as string | undefined) ?? null,
      });
      if (!actorUserId) {
        return NextResponse.json({
          response_action: "errors",
          errors: {
            title: SLACK_NOT_LINKED_EPHEMERAL,
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

      if (approvalId) {
        blocks.push(
          ...buildApprovalActionButtons({
            approvalId,
            orgId,
            changeEventId: change.id as string,
            outboxId: "",
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

  // Phase 5 — readiness / prediction shortcuts from early-warning Slack messages
  if (action.action_id.startsWith("p5_")) {
    let meta: { orgId?: string; changeEventId?: string; releaseId?: string; predictionType?: string };
    try {
      meta = JSON.parse(action.value ?? "{}") as typeof meta;
    } catch {
      return NextResponse.json({
        response_type: "ephemeral",
        text: "Invalid action payload.",
      });
    }
    const orgIdP5 = String(meta.orgId ?? "");
    if (!orgIdP5) {
      return NextResponse.json({
        response_type: "ephemeral",
        text: "Missing organization.",
      });
    }
    const adminP5 = createAdminClient();
    const { data: installP5 } = await adminP5
      .from("slack_installations")
      .select("bot_token")
      .eq("org_id", orgIdP5)
      .eq("status", "ACTIVE")
      .maybeSingle();
    if (!installP5?.bot_token) {
      return NextResponse.json({
        response_type: "ephemeral",
        text: "Slack is not connected for this organization.",
      });
    }
    const solvrenId = await resolveSlackToSolvrenUserId({
      admin: adminP5,
      orgId: orgIdP5,
      slackTeamId: teamId,
      slackUserId,
      botToken: installP5.bot_token,
    });
    if (!solvrenId) {
      return NextResponse.json({ response_type: "ephemeral", text: SLACK_NOT_LINKED_EPHEMERAL });
    }

    if (action.action_id === "p5_view_readiness") {
      return NextResponse.json({
        response_type: "ephemeral",
        text: `Open readiness: ${absoluteUrl("/readiness")}`,
      });
    }

    if (action.action_id === "p5_follow_release" && meta.releaseId) {
      const { error: rfErr } = await adminP5.from("release_followers").upsert(
        {
          org_id: orgIdP5,
          user_id: solvrenId,
          release_id: meta.releaseId,
        },
        { onConflict: "user_id,release_id" }
      );
      if (rfErr) {
        return NextResponse.json({
          response_type: "ephemeral",
          text: "Could not follow this release. Try again.",
        });
      }
      return NextResponse.json({
        response_type: "ephemeral",
        text: "You will receive updates for this release.",
      });
    }

    if (action.action_id === "p5_mute_prediction" && meta.predictionType) {
      const expires = new Date(Date.now() + 30 * 86400000).toISOString();
      const { error: mErr } = await adminP5.from("notification_mutes").insert({
        org_id: orgIdP5,
        user_id: solvrenId,
        mute_type: "PREDICTION_TYPE",
        mute_value: meta.predictionType,
        expires_at: expires,
      });
      if (mErr) {
        return NextResponse.json({
          response_type: "ephemeral",
          text: "Could not save mute. Try again.",
        });
      }
      return NextResponse.json({
        response_type: "ephemeral",
        text: "Muted this prediction type for 30 days.",
      });
    }

    if (action.action_id === "p5_ask_resolve" && meta.changeEventId) {
      await addTimelineEvent({
        supabase: adminP5,
        orgId: orgIdP5,
        changeEventId: meta.changeEventId,
        actorUserId: solvrenId,
        eventType: "COMMENT_ADDED",
        title: "Slack: request to resolve blockers",
        description: "An executive asked the team to resolve predicted blockers (from Slack early warning).",
        metadata: { source: "slack_p5_ask_resolve" },
      });
      return NextResponse.json({
        response_type: "ephemeral",
        text: "Posted a timeline note on the change asking the team to resolve blockers.",
      });
    }

    return NextResponse.json({
      response_type: "ephemeral",
      text: "This action is not available.",
    });
  }

  if (action.action_id === "executive_dm_approve" || action.action_id === "executive_dm_delay") {
    const triggerId = payload.trigger_id;
    if (!triggerId) return NextResponse.json({ ok: true });
    let meta: { orgId?: string; changeId?: string };
    try {
      meta = JSON.parse(action.value ?? "{}") as { orgId?: string; changeId?: string };
    } catch {
      return NextResponse.json({
        response_type: "ephemeral",
        text: "Invalid action payload.",
      });
    }
    if (!meta.orgId || !meta.changeId) {
      return NextResponse.json({
        response_type: "ephemeral",
        text: "Missing org or change context.",
      });
    }
    const admin = createAdminClient();
    const { data: install } = await admin
      .from("slack_installations")
      .select("bot_token")
      .eq("org_id", meta.orgId)
      .eq("status", "ACTIVE")
      .maybeSingle();
    if (!install?.bot_token) return NextResponse.json({ ok: true });

    const isApprove = action.action_id === "executive_dm_approve";
    await slackApi(install.bot_token, "views.open", {
      trigger_id: triggerId,
      view: {
        type: "modal",
        callback_id: "executive_decision_modal",
        private_metadata: JSON.stringify({
          orgId: meta.orgId,
          changeId: meta.changeId,
          decision: isApprove ? "APPROVE" : "DELAY",
        }),
        title: { type: "plain_text", text: isApprove ? "Confirm approval" : "Delay change" },
        submit: { type: "plain_text", text: "Submit" },
        close: { type: "plain_text", text: "Cancel" },
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: isApprove
                ? "*Executive approval*\nRecords your sign-off to proceed from a leadership perspective. Domain approvals still apply."
                : "*Delay*\nShare a short reason (required).",
            },
          },
          {
            type: "input",
            block_id: "comment",
            optional: isApprove,
            label: { type: "plain_text", text: isApprove ? "Optional note" : "Reason" },
            element: {
              type: "plain_text_input",
              action_id: "value",
              multiline: true,
            },
          },
        ],
      },
    });
    return new Response(null, { status: 200 });
  }

  const actionWithOption = action as {
    action_id?: string;
    value?: string;
    selected_option?: { value?: string };
  };

  // Overflow menu (Delegate / Defer / Follow / Mute)
  if (actionWithOption.action_id === "approval_overflow") {
    const rawOv = actionWithOption.selected_option?.value;
    let ov: { k?: string; approval_id?: string; org_id?: string; change_event_id?: string };
    try {
      ov = rawOv ? (JSON.parse(rawOv) as typeof ov) : {};
    } catch {
      return NextResponse.json({ response_type: "ephemeral", text: "Invalid menu selection." });
    }
    const approvalIdOv = String(ov.approval_id ?? "");
    const orgIdOv = String(ov.org_id ?? "");
    const changeEventIdOv = String(ov.change_event_id ?? "");
    const k = String(ov.k ?? "");
    if (!approvalIdOv || !orgIdOv || !changeEventIdOv) {
      return NextResponse.json({ response_type: "ephemeral", text: "Missing approval context." });
    }

    const triggerIdOv = payload.trigger_id;
    const adminOv = createAdminClient();
    const { data: installOv } = await adminOv
      .from("slack_installations")
      .select("bot_token")
      .eq("org_id", orgIdOv)
      .eq("status", "ACTIVE")
      .maybeSingle();
    if (!installOv?.bot_token) return new Response(null, { status: 200 });

    if (k === "delegate" || k === "defer") {
      if (!triggerIdOv) return new Response(null, { status: 200 });
      if (k === "delegate") {
        await slackApi(installOv.bot_token, "views.open", {
          trigger_id: triggerIdOv,
          view: {
            type: "modal",
            callback_id: "approval_delegate_modal",
            private_metadata: JSON.stringify({ orgId: orgIdOv, approvalId: approvalIdOv }),
            title: { type: "plain_text", text: "Delegate approval" },
            submit: { type: "plain_text", text: "Save" },
            close: { type: "plain_text", text: "Cancel" },
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: "Enter the Solvren user email of your delegate. They must already belong to your org.",
                },
              },
              {
                type: "input",
                block_id: "delegate_email",
                label: { type: "plain_text", text: "Email" },
                element: {
                  type: "plain_text_input",
                  action_id: "value",
                  placeholder: { type: "plain_text", text: "name@company.com" },
                },
              },
            ],
          },
        });
      } else {
        await slackApi(installOv.bot_token, "views.open", {
          trigger_id: triggerIdOv,
          view: {
            type: "modal",
            callback_id: "approval_defer_modal",
            private_metadata: JSON.stringify({
              orgId: orgIdOv,
              approvalId: approvalIdOv,
              changeEventId: changeEventIdOv,
              channelId,
              messageTs,
              slackUserId,
            }),
            title: { type: "plain_text", text: "Defer reminder" },
            submit: { type: "plain_text", text: "Save" },
            close: { type: "plain_text", text: "Cancel" },
            blocks: [
              {
                type: "input",
                block_id: "when",
                label: { type: "plain_text", text: "When" },
                element: {
                  type: "static_select",
                  action_id: "value",
                  options: [
                    {
                      text: { type: "plain_text", text: "Tomorrow morning (9:00, weekdays)" },
                      value: "tomorrow",
                    },
                    {
                      text: { type: "plain_text", text: "In 24 hours" },
                      value: "24h",
                    },
                  ],
                },
              },
            ],
          },
        });
      }
      return new Response(null, { status: 200 });
    }

    if (k === "follow") {
      const solvrenId = await resolveSlackToSolvrenUserId({
        admin: adminOv,
        orgId: orgIdOv,
        slackTeamId: teamId,
        slackUserId,
        botToken: installOv.bot_token,
      });
      if (!solvrenId) {
        return NextResponse.json({ response_type: "ephemeral", text: SLACK_NOT_LINKED_EPHEMERAL });
      }
      const { error: fErr } = await adminOv.from("change_followers").upsert(
        {
          org_id: orgIdOv,
          user_id: solvrenId,
          change_event_id: changeEventIdOv,
        },
        { onConflict: "user_id,change_event_id" }
      );
      if (fErr) {
        return NextResponse.json({
          response_type: "ephemeral",
          text: "Could not follow this change. Try again.",
        });
      }
      return NextResponse.json({
        response_type: "ephemeral",
        text: "You will receive updates for this change.",
      });
    }

    if (k === "mute") {
      const solvrenId = await resolveSlackToSolvrenUserId({
        admin: adminOv,
        orgId: orgIdOv,
        slackTeamId: teamId,
        slackUserId,
        botToken: installOv.bot_token,
      });
      if (!solvrenId) {
        return NextResponse.json({ response_type: "ephemeral", text: SLACK_NOT_LINKED_EPHEMERAL });
      }
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { error: mErr } = await adminOv.from("notification_mutes").insert({
        org_id: orgIdOv,
        user_id: solvrenId,
        mute_type: "NOTIFICATION_TEMPLATE",
        mute_value: "approval_request",
        expires_at: expires,
      });
      if (mErr) {
        return NextResponse.json({
          response_type: "ephemeral",
          text: "Could not save mute. Try again.",
        });
      }
      return NextResponse.json({
        response_type: "ephemeral",
        text: "Muted similar notifications for 24 hours.",
      });
    }

    return new Response(null, { status: 200 });
  }

  const parsedVal =
    action.action_id === "approval_overflow"
      ? null
      : parseApprovalActionValue(action.value ?? undefined);
  const approvalId = parsedVal?.approval_id ?? "";

  if (
    !approvalId &&
    action.action_id !== "approval_overflow" &&
    action.action_id !== "executive_dm_approve" &&
    action.action_id !== "executive_dm_delay"
  ) {
    return NextResponse.json(
      { error: "Missing approval_id in action value" },
      { status: 400 }
    );
  }

  // Legacy: Add comment
  if (action.action_id === "approval_comment" && approvalId) {
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

  if (action.action_id === "approval_request_info" && approvalId) {
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
        callback_id: "approval_request_info_modal",
        private_metadata: JSON.stringify({ approvalId }),
        title: { type: "plain_text", text: "Request information" },
        submit: { type: "plain_text", text: "Send" },
        close: { type: "plain_text", text: "Cancel" },
        blocks: [
          {
            type: "input",
            block_id: "question",
            label: { type: "plain_text", text: "What do you need?" },
            element: {
              type: "plain_text_input",
              action_id: "value",
              multiline: true,
            },
          },
        ],
      },
    });
    return new Response(null, { status: 200 });
  }

  if (action.action_id === "approval_open" && approvalId) {
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

  if (action.action_id === "approval_open_overview" && approvalId) {
    const admin = createAdminClient();
    const { data: approval } = await admin
      .from("approvals")
      .select("change_event_id")
      .eq("id", approvalId)
      .maybeSingle();
    const changeId = approval?.change_event_id as string | undefined;
    const url = changeId
      ? absoluteUrl(`/executive/changes/${changeId}?view=executive-lite`)
      : absoluteUrl("/dashboard");
    return NextResponse.json({
      response_type: "ephemeral",
      text: changeId ? `Executive overview: ${url}` : "Change not found.",
    });
  }

  if (action.action_id !== "approval_approve" && action.action_id !== "approval_reject") {
    return NextResponse.json({ ok: true });
  }

  if (!channelId || !messageTs || !parsedVal) {
    return NextResponse.json(
      { error: "Missing channel, message, or approval context" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  let orgId = parsedVal.org_id ?? "";
  let changeEventId = parsedVal.change_event_id ?? "";
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
    orgId = orgId || (approvalRow.org_id as string);
    changeEventId = changeEventId || (approvalRow.change_event_id as string);
  }
  const outboxId = parsedVal.outbox_id?.trim() || undefined;

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

  const { data: installAct } = await admin
    .from("slack_installations")
    .select("bot_token")
    .eq("org_id", orgId)
    .eq("status", "ACTIVE")
    .maybeSingle();

  const mappedUserId = await resolveSlackToSolvrenUserId({
    admin,
    orgId,
    slackTeamId: teamId,
    slackUserId,
    botToken: (installAct?.bot_token as string | undefined) ?? null,
  });

  if (!mappedUserId) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: SLACK_NOT_LINKED_EPHEMERAL,
    });
  }

  const jobPayload: SlackInteractiveJobPayload = {
    kind: action.action_id === "approval_approve" ? "approval_approve" : "approval_reject",
    orgId,
    approvalId,
    changeEventId,
    slackUserId,
    teamId,
    channelId,
    messageTs,
    outboxId,
    comment: null,
  };

  const jobDedupe = `${dedupeKey}:job`;
  try {
    const { inserted } = await enqueueSlackInteractiveJob(admin, {
      dedupeKey: jobDedupe,
      orgId,
      payload: jobPayload,
    });

    if (!inserted) {
      return new Response(null, { status: 200 });
    }
  } catch {
    await admin.from("slack_action_events").delete().eq("dedupe_key", dedupeKey);
    return NextResponse.json({
      response_type: "ephemeral",
      text: "Unable to queue approval. Try again.",
    });
  }

  return new Response(null, { status: 200 });
}
