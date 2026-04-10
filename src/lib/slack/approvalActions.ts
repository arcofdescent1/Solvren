import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { runApprovalDecisionPipeline } from "@/lib/approvals/runApprovalDecisionPipeline";
import { canUserActOnApproval } from "@/lib/approvals/canActOnApproval";
import { resolveSlackToSolvrenUserId } from "@/lib/slack/resolveSlackUser";
import {
  buildDecisionStateBlocks,
  buildThreadUpdateText,
} from "@/services/slack/blockBuilders";
import { enqueueSlack } from "@/services/notifications/enqueueSlack";

export type SlackApprovalActionValue = {
  approval_id: string;
  org_id?: string;
  change_event_id?: string;
  outbox_id?: string;
  /** Legacy keys */
  approvalId?: string;
  orgId?: string;
  changeEventId?: string;
  outboxId?: string;
};

export function parseApprovalActionValue(raw: string | undefined): SlackApprovalActionValue | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as SlackApprovalActionValue;
    const approval_id = String(p.approval_id ?? p.approvalId ?? "").trim();
    if (!approval_id) return null;
    return {
      approval_id,
      org_id: (p.org_id ?? p.orgId) as string | undefined,
      change_event_id: (p.change_event_id ?? p.changeEventId) as string | undefined,
      outbox_id: (p.outbox_id ?? p.outboxId) as string | undefined,
    };
  } catch {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return { approval_id: trimmed };
  }
}

export function buildApprovalActionButtonValue(args: {
  orgId: string;
  changeEventId: string;
  approvalId: string;
  outboxId?: string;
}): string {
  return JSON.stringify({
    approval_id: args.approvalId,
    org_id: args.orgId,
    change_event_id: args.changeEventId,
    outbox_id: args.outboxId ?? "",
  });
}

export type SlackInteractiveJobPayload = {
  kind: "approval_approve" | "approval_reject";
  orgId: string;
  approvalId: string;
  changeEventId: string;
  slackUserId: string;
  teamId: string;
  channelId: string;
  messageTs: string;
  outboxId?: string;
  comment?: string | null;
};

function absoluteUrl(path: string) {
  return path.startsWith("http") ? path : `${env.appUrl}${path}`;
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
  const json = (await res.json()) as { ok?: boolean; error?: string };
  if (!json?.ok) throw new Error(json?.error ?? `Slack API error: ${method}`);
  return json;
}

export async function enqueueSlackInteractiveJob(
  admin: SupabaseClient,
  args: { dedupeKey: string; orgId: string; payload: SlackInteractiveJobPayload }
): Promise<{ inserted: boolean }> {
  const { error } = await admin.from("slack_interactive_jobs").insert({
    org_id: args.orgId,
    dedupe_key: args.dedupeKey,
    payload_json: args.payload as unknown as Record<string, unknown>,
    status: "PENDING",
  });
  if (error) {
    if (/duplicate key/i.test(error.message)) return { inserted: false };
    throw new Error(error.message);
  }
  return { inserted: true };
}

/**
 * Worker: complete approve/reject from Slack after fast HTTP ack.
 */
export async function processSlackApprovalInteractiveJob(
  admin: SupabaseClient,
  payload: SlackInteractiveJobPayload
): Promise<{ ok: boolean; userMessage: string }> {
  const {
    orgId,
    approvalId,
    changeEventId,
    slackUserId,
    channelId,
    messageTs,
    outboxId,
    kind,
    teamId,
  } = payload;

  const { data: install } = await admin
    .from("slack_installations")
    .select("bot_token")
    .eq("org_id", orgId)
    .eq("status", "ACTIVE")
    .maybeSingle();
  const botToken = install?.bot_token as string | undefined;

  const solvrenUserId = await resolveSlackToSolvrenUserId({
    admin,
    orgId,
    slackTeamId: teamId,
    slackUserId,
    botToken: botToken ?? null,
  });

  if (!solvrenUserId) {
    if (botToken) {
      await slackApi(botToken, "chat.postEphemeral", {
        channel: channelId,
        user: slackUserId,
        text: "Your Slack account is not linked to Solvren. Contact your administrator.",
      });
    }
    return { ok: false, userMessage: "not_linked" };
  }

  const { data: approval, error: apErr } = await admin
    .from("approvals")
    .select(
      "id, org_id, change_event_id, approver_user_id, delegate_user_id, decision, domain, approval_area"
    )
    .eq("id", approvalId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (apErr || !approval) {
    if (botToken) {
      await slackApi(botToken, "chat.postEphemeral", {
        channel: channelId,
        user: slackUserId,
        text: "Approval not found.",
      });
    }
    return { ok: false, userMessage: "not_found" };
  }

  const allowed = await canUserActOnApproval(admin, {
    orgId,
    approval: {
      approver_user_id: approval.approver_user_id as string,
      delegate_user_id: (approval as { delegate_user_id?: string | null }).delegate_user_id ?? null,
    },
    actorUserId: solvrenUserId,
  });

  if (!allowed) {
    if (botToken) {
      await slackApi(botToken, "chat.postEphemeral", {
        channel: channelId,
        user: slackUserId,
        text: "You are not the assigned approver (or permitted delegate) for this item.",
      });
    }
    return { ok: false, userMessage: "forbidden" };
  }

  if (approval.decision !== "PENDING") {
    if (botToken) {
      await slackApi(botToken, "chat.postEphemeral", {
        channel: channelId,
        user: slackUserId,
        text: "This approval has already been decided.",
      });
    }
    return { ok: false, userMessage: "already_decided" };
  }

  const { data: membership } = await admin
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", solvrenUserId)
    .maybeSingle();

  const decision = kind === "approval_approve" ? "APPROVED" : "REJECTED";
  const pipeline = await runApprovalDecisionPipeline(admin, {
    approval: {
      id: approval.id as string,
      change_event_id: approval.change_event_id as string,
      approver_user_id: approval.approver_user_id as string,
      decision: approval.decision as string,
      org_id: approval.org_id as string,
      domain: approval.domain as string | null,
      approval_area: approval.approval_area as string | null,
    },
    actorUserId: solvrenUserId,
    decision,
    comment: payload.comment ?? null,
    membershipOrgRole: (membership as { role?: string | null } | null)?.role ?? null,
    fromSlack: true,
  });

  if (!pipeline.ok) {
    const msg =
      pipeline.code === "REQUIRED_EVIDENCE_MISSING"
        ? "Cannot approve: missing required evidence."
        : pipeline.code === "NOT_READY"
          ? "Change is not ready for approval."
          : pipeline.code === "GOVERNANCE_BLOCK"
            ? pipeline.error
            : pipeline.code === "GOVERNANCE_REQUIRE_APPROVAL"
              ? pipeline.error
              : pipeline.code === "ESCALATED_REQUIRES_EXEC"
                ? pipeline.error
                : pipeline.error;
    if (botToken) {
      await slackApi(botToken, "chat.postEphemeral", {
        channel: channelId,
        user: slackUserId,
        text: msg.slice(0, 2000),
      });
    }
    return { ok: false, userMessage: msg };
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
    channelId;
  const threadTs =
    slackRef?.message_ts ??
    (change as { slack_message_ts?: string })?.slack_message_ts ??
    messageTs;

  if (threadChannel && threadTs && botToken) {
    const remainingCount = (pendingApprovals ?? []).length;
    const revenueAtRisk =
      change?.revenue_at_risk != null ? Number(change.revenue_at_risk) : null;
    const riskScore =
      assessment?.risk_score_raw != null ? Number(assessment.risk_score_raw) : 0;
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
        (change as { revenue_exposure_multiplier?: number })?.revenue_exposure_multiplier ?? 1
      ),
      revenueSurface: (change as { revenue_surface?: string })?.revenue_surface ?? null,
    });

    await enqueueSlack(admin, {
      orgId,
      kind: "slack_message_update",
      dedupeKey: `slack_update_decision:${approvalId}:${decision}:${Date.now()}`,
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
      dedupeKey: `approval_decision_thread:${approvalId}:${decision}:${Date.now()}`,
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

  if (botToken) {
    await slackApi(botToken, "chat.postEphemeral", {
      channel: channelId,
      user: slackUserId,
      text: decision === "APPROVED" ? "Approved ✅" : "Rejected ❌",
    });
  }

  return { ok: true, userMessage: "ok" };
}
