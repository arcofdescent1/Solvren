export function buildDailyInboxBlocks(params: {
  dateLabel: string;
  summaryLine: string;
  items: Array<{
    title: string;
    riskBucket: string | null;
    metaLine?: string;
    changeUrl: string;
    approveAction?: {
      orgId: string;
      changeEventId: string;
      approvalId: string;
      outboxId: string;
    };
    rejectAction?: {
      orgId: string;
      changeEventId: string;
      approvalId: string;
      outboxId: string;
    };
  }>;
}) {
  const blocks: Record<string, unknown>[] = [];

  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: `Revenue Risk Inbox — ${params.dateLabel}`,
    },
  });

  blocks.push({
    type: "section",
    text: { type: "mrkdwn", text: params.summaryLine },
  });

  blocks.push({ type: "divider" });

  for (const it of params.items.slice(0, 8)) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*${escapeMrkdwn(it.title)}*\n` +
          (it.riskBucket ? `Risk: *${escapeMrkdwn(it.riskBucket)}*\n` : "") +
          (it.metaLine ? `${it.metaLine}\n` : "") +
          `<${it.changeUrl}|Open change →>`,
      },
    });

    const elements: Record<string, unknown>[] = [
      {
        type: "button",
        text: { type: "plain_text", text: "View" },
        url: it.changeUrl,
      },
    ];

    if (it.approveAction && it.rejectAction) {
      elements.push({
        type: "button",
        style: "primary",
        text: { type: "plain_text", text: "Approve" },
        action_id: "approval_approve",
        value: JSON.stringify(it.approveAction),
      });
      elements.push({
        type: "button",
        style: "danger",
        text: { type: "plain_text", text: "Reject" },
        action_id: "approval_reject",
        value: JSON.stringify(it.rejectAction),
      });
    }

    blocks.push({ type: "actions", elements });
    blocks.push({ type: "divider" });
  }

  return blocks;
}

function escapeMrkdwn(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
