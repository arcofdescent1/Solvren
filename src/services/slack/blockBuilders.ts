// src/services/slack/blockBuilders.ts

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
  /** Full value for outbox flow (orgId, changeEventId, approvalId, outboxId) */
  fullValue?: string;
  /** When provided, Open button uses URL for one-click; else uses action */
  changeUrl?: string | null;
}) {
  const { approvalId, fullValue, changeUrl } = args;
  const value = fullValue ?? approvalId;
  const openButton = changeUrl
    ? {
        type: "button" as const,
        text: { type: "plain_text" as const, text: "Open" },
        url: changeUrl,
      }
    : {
        type: "button" as const,
        text: { type: "plain_text" as const, text: "Open" },
        action_id: "approval_open" as const,
        value,
      };
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
          text: { type: "plain_text" as const, text: "Add comment" },
          action_id: "approval_comment",
          value,
        },
        openButton,
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
