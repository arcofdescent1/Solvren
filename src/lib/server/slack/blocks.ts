function fmtMoney(n: number) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${Math.round(n).toLocaleString()}`;
  }
}

export function buildApprovalNeededBlocks(args: {
  title: string;
  riskBucket?: string | null;
  changeUrl: string;
  orgId: string;
  changeEventId: string;
  approvalId: string;
  outboxId: string;
  revenueAtRisk?: number | null;
  exposureMultiplier?: number | null;
  revenueSurface?: string | null;
  estimatedMrrAffected?: number | null;
  percentCustomerBaseAffected?: number | null;
  revenueRiskScore?: number | null;
  mitigations?: Array<{ recommendation: string }>;
}) {
  const value = JSON.stringify({
    orgId: args.orgId,
    changeEventId: args.changeEventId,
    approvalId: args.approvalId,
    outboxId: args.outboxId,
  });

  const fields: Array<{ type: string; text: string }> = [];
  if (args.riskBucket)
    fields.push({ type: "mrkdwn", text: `*Risk:*\n${args.riskBucket}` });

  const blocks: Record<string, unknown>[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "Approval required" },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*${escapeMrkdwn(args.title)}*` },
    },
    ...(fields.length ? [{ type: "section" as const, fields }] : []),
    {
      type: "actions",
      elements: [
        {
          type: "button",
          style: "primary",
          text: { type: "plain_text", text: "Approve" },
          action_id: "approval_approve",
          value,
        },
        {
          type: "button",
          style: "danger",
          text: { type: "plain_text", text: "Reject" },
          action_id: "approval_reject",
          value,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "View" },
          url: args.changeUrl,
        },
      ],
    },
  ];

  const hasRevenue =
    (args.revenueAtRisk != null && args.revenueAtRisk > 0) ||
    args.exposureMultiplier != null ||
    (args.revenueSurface != null && args.revenueSurface !== "") ||
    args.estimatedMrrAffected != null ||
    args.revenueRiskScore != null;
  if (hasRevenue) {
    const mult = args.exposureMultiplier ?? 1;
    const surface = args.revenueSurface ?? "SUBSCRIPTION";
    const mrr = args.estimatedMrrAffected ?? 0;
    const pct = args.percentCustomerBaseAffected ?? 0;
    const revRisk = args.revenueRiskScore ?? null;
    const riskStr =
      args.revenueAtRisk != null && args.revenueAtRisk > 0
        ? fmtMoney(args.revenueAtRisk)
        : "—";
    const exposureLine =
      `Surface: *${surface}* • MRR: *$${Math.round(mrr).toLocaleString()}* • Impact: *${pct}%*` +
      (revRisk != null ? ` • Revenue risk: *${Math.round(revRisk * 100)}%*` : "");
    blocks.splice(blocks.length - 1, 0, {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*Revenue at Risk:* ${riskStr}\n` +
          `*Exposure:* ${mult.toFixed(2)}×\n` +
          exposureLine,
      },
    });
  }
  const topMitigations = (args.mitigations ?? []).slice(0, 2);
  if (topMitigations.length > 0) {
    blocks.splice(blocks.length - 1, 0, {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*Mitigations:*\n` +
          topMitigations.map((m) => `• ${escapeMrkdwn(m.recommendation)}`).join("\n"),
      },
    });
  }

  return blocks;
}

export function buildApprovalUpdatedBlocks(args: {
  title: string;
  statusLine: string;
  viewUrl: string;
  remainingApprovals?: number;
  revenueAtRisk?: number | null;
}) {
  const statusText =
    args.remainingApprovals != null
      ? `${args.statusLine}  ·  Remaining: ${args.remainingApprovals}`
      : args.statusLine;
  const revenueText =
    args.revenueAtRisk != null && args.revenueAtRisk > 0
      ? `  ·  Revenue at Risk: ${fmtMoney(args.revenueAtRisk)}`
      : "";
  return [
    {
      type: "header",
      text: { type: "plain_text", text: "Approval decision" },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*${escapeMrkdwn(args.title)}*` },
    },
    {
      type: "context" as const,
      elements: [
        {
          type: "mrkdwn" as const,
          text: statusText + revenueText,
        },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View change" },
          url: args.viewUrl,
        },
      ],
    },
  ];
}

function escapeMrkdwn(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
