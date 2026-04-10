// src/services/slack/blockBuilders.ts

import { env } from "@/lib/env";

type Mitigation = {
  recommendation: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
};

function fmtMoney(n: number) {
  const v = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `$${Math.round(v).toLocaleString()}`;
  }
}

export function buildApprovalRequestedBlocks(args: {
  title: string;
  changeUrl: string;
  riskScore: number;
  revenueAtRisk: number;
  exposureMultiplier: number;
  revenueSurface: string | null;
  estimatedMrrAffected?: number | null;
  percentCustomerBaseAffected?: number | null;
  revenueRiskScore?: number | null;
  dueAt?: string | null;
  mitigations?: Mitigation[];
}) {
  const {
    title,
    changeUrl,
    riskScore,
    revenueAtRisk,
    exposureMultiplier,
    revenueSurface,
    estimatedMrrAffected,
    percentCustomerBaseAffected,
    revenueRiskScore,
    dueAt,
    mitigations = [],
  } = args;

  const topMitigations = mitigations.slice(0, 2);
  const surface = revenueSurface ?? "SUBSCRIPTION";
  const mrr = estimatedMrrAffected ?? 0;
  const pct = percentCustomerBaseAffected ?? 0;
  const revRisk = revenueRiskScore ?? null;
  const exposureLine =
    `Surface: *${surface}* • MRR: *$${Math.round(mrr).toLocaleString()}* • Impact: *${pct}%*` +
    (revRisk != null ? ` • Revenue risk: *${Math.round(revRisk * 100)}%*` : "");

  const blocks: unknown[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "Approval requested" },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*<${changeUrl}|${title || "Untitled change"}>*`,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Revenue at Risk*\n${fmtMoney(revenueAtRisk)}` },
        { type: "mrkdwn", text: `*Risk Score*\n${Math.round(riskScore)}` },
        { type: "mrkdwn", text: `*Exposure*\n${exposureMultiplier.toFixed(2)}×` },
        { type: "mrkdwn", text: `*Surface*\n${revenueSurface ?? "—"}` },
      ],
    },
    { type: "context", elements: [{ type: "mrkdwn", text: exposureLine }] },
  ];

  if (dueAt) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `*Due:* ${new Date(dueAt).toLocaleString()}`,
        },
      ],
    });
  }

  if (topMitigations.length > 0) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*Suggested mitigations*\n` +
          topMitigations.map((m) => `• ${m.recommendation}`).join("\n"),
      },
    });
  }

  blocks.push({ type: "divider" });

  return blocks;
}

export function buildApprovalActionButtons(args: {
  approvalId: string;
  orgId: string;
  changeEventId: string;
  outboxId?: string;
  /** Operator change URL (optional); executive overview always uses app URL */
  changeUrl?: string | null;
}) {
  const { approvalId, orgId, changeEventId, outboxId } = args;
  const value = JSON.stringify({
    approval_id: approvalId,
    org_id: orgId,
    change_event_id: changeEventId,
    outbox_id: outboxId ?? "",
  });

  const appBase = env.appUrl.replace(/\/$/, "");
  const executiveOverviewUrl = `${appBase}/executive/changes/${changeEventId}?view=executive-lite`;

  const overflowValue = (k: string) =>
    JSON.stringify({
      k,
      approval_id: approvalId,
      org_id: orgId,
      change_event_id: changeEventId,
      outbox_id: outboxId ?? "",
    });

  return [
    {
      type: "actions" as const,
      elements: [
        {
          type: "button" as const,
          style: "primary" as const,
          text: { type: "plain_text" as const, text: "Approve" },
          action_id: "approval_approve",
          value,
        },
        {
          type: "button" as const,
          style: "danger" as const,
          text: { type: "plain_text" as const, text: "Reject" },
          action_id: "approval_reject",
          value,
          confirm: {
            title: { type: "plain_text" as const, text: "Reject change?" },
            text: {
              type: "mrkdwn" as const,
              text: "This will mark your decision as *REJECTED*.",
            },
            confirm: { type: "plain_text" as const, text: "Reject" },
            deny: { type: "plain_text" as const, text: "Cancel" },
          },
        },
        {
          type: "button" as const,
          text: { type: "plain_text" as const, text: "Request Info" },
          action_id: "approval_request_info",
          value,
        },
        {
          type: "button" as const,
          text: { type: "plain_text" as const, text: "Open Overview" },
          url: executiveOverviewUrl,
        },
        {
          type: "overflow" as const,
          action_id: "approval_overflow",
          options: [
            {
              text: { type: "plain_text" as const, text: "Delegate" },
              value: overflowValue("delegate"),
            },
            {
              text: { type: "plain_text" as const, text: "Defer" },
              value: overflowValue("defer"),
            },
            {
              text: { type: "plain_text" as const, text: "Follow" },
              value: overflowValue("follow"),
            },
            {
              text: { type: "plain_text" as const, text: "Mute similar" },
              value: overflowValue("mute"),
            },
          ],
        },
      ],
    },
  ];
}

export function buildThreadUpdateText(args: {
  actorName?: string | null;
  decision: "APPROVED" | "REJECTED";
  remainingApprovals: number;
  revenueAtRisk: number;
  changeUrl: string;
}) {
  const { actorName, decision, remainingApprovals, revenueAtRisk, changeUrl } =
    args;

  const who = actorName ? `*${actorName}*` : "An approver";
  const remaining =
    remainingApprovals <= 0 ? "none" : String(remainingApprovals);

  return (
    `${who} *${decision}* this change.\n` +
    `*Remaining approvals:* ${remaining}\n` +
    `*Revenue at Risk:* ${fmtMoney(revenueAtRisk)}\n` +
    `<${changeUrl}|Open change>`
  );
}

export function buildDecisionStateBlocks(args: {
  title: string;
  changeUrl: string;
  decision: "APPROVED" | "REJECTED";
  actorName?: string | null;
  riskScore: number;
  revenueAtRisk: number;
  exposureMultiplier: number;
  revenueSurface: string | null;
}) {
  const {
    title,
    changeUrl,
    decision,
    actorName,
    riskScore,
    revenueAtRisk,
    exposureMultiplier,
    revenueSurface,
  } = args;

  const who = actorName ? `by *${actorName}*` : "";
  const decisionLine =
    decision === "APPROVED"
      ? `✅ *APPROVED* ${who}`
      : `⛔ *REJECTED* ${who}`;

  return [
    {
      type: "header",
      text: { type: "plain_text", text: "Approval decision recorded" },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*<${changeUrl}|${title || "Untitled change"}>*\n${decisionLine}`,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Revenue at Risk*\n${fmtMoney(revenueAtRisk)}`,
        },
        { type: "mrkdwn", text: `*Risk Score*\n${Math.round(riskScore)}` },
        {
          type: "mrkdwn",
          text: `*Exposure*\n${exposureMultiplier.toFixed(2)}×`,
        },
        { type: "mrkdwn", text: `*Surface*\n${revenueSurface ?? "—"}` },
      ],
    },
  ];
}

/** Phase 5 — Slack early-warning actions (wired to /api/integrations/slack/actions). */
export function buildPhase5PredictionSlackBlocks(args: {
  title: string;
  bodyMd: string;
  changeUrl: string;
  orgId: string;
  changeEventId: string;
  predictionType: string;
  releaseId: string | null;
}): unknown[] {
  const compact = (o: Record<string, string>) => JSON.stringify(o);
  const elements: unknown[] = [
    {
      type: "button",
      text: { type: "plain_text", text: "View readiness" },
      action_id: "p5_view_readiness",
      value: compact({ orgId: args.orgId }),
    },
  ];
  if (args.releaseId) {
    elements.push({
      type: "button",
      text: { type: "plain_text", text: "Follow release" },
      action_id: "p5_follow_release",
      value: compact({ orgId: args.orgId, releaseId: args.releaseId }),
    });
  }
  elements.push(
    {
      type: "button",
      text: { type: "plain_text", text: "View change" },
      url: args.changeUrl,
    },
    {
      type: "button",
      text: { type: "plain_text", text: "Mute prediction" },
      action_id: "p5_mute_prediction",
      value: compact({ orgId: args.orgId, predictionType: args.predictionType }),
    },
    {
      type: "button",
      text: { type: "plain_text", text: "Ask team" },
      action_id: "p5_ask_resolve",
      value: compact({ orgId: args.orgId, changeEventId: args.changeEventId }),
    }
  );
  return [
    {
      type: "section",
      text: { type: "mrkdwn", text: `*${args.title}*\n${args.bodyMd}` },
    },
    { type: "actions", elements },
  ];
}
