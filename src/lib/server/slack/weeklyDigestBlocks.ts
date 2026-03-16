export function buildWeeklyDigestBlocks(params: {
  rangeLabel: string;
  summaryLine: string;
  sections: Array<{
    title: string;
    items: Array<{
      title: string;
      riskBucket?: string | null;
      metaLine?: string;
      changeUrl: string;
    }>;
  }>;
}) {
  const blocks: Record<string, unknown>[] = [];

  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: `Weekly Risk Digest — ${params.rangeLabel}`,
    },
  });

  blocks.push({
    type: "section",
    text: { type: "mrkdwn", text: params.summaryLine },
  });

  blocks.push({ type: "divider" });

  for (const section of params.sections.slice(0, 6)) {
    const items = section.items.slice(0, 8);

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${escapeMrkdwn(section.title)}* (${items.length})`,
      },
    });

    for (const it of items) {
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

      blocks.push({ type: "actions", elements });
      blocks.push({ type: "divider" });
    }
  }

  return blocks;
}

function escapeMrkdwn(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
