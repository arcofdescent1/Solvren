import type { ExecutiveChangeView } from "@/lib/executive/types";

function escapeMrkdwn(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function recLabel(r: ExecutiveChangeView["recommendation"]): string {
  switch (r) {
    case "PROCEED":
      return "Proceed";
    case "PROCEED_WITH_CAUTION":
      return "Proceed With Caution";
    case "DELAY":
      return "Delay";
    case "ESCALATE":
      return "Escalate";
    default:
      return r;
  }
}

/** Executive DM: overlay decisions only (no domain approval buttons). */
export function buildExecutiveDmSlackBlocks(args: {
  view: ExecutiveChangeView;
  overviewUrl: string;
  orgId: string;
  /** Phase 2: single-line “why this needs you” when provided */
  interruptionReason?: string | null;
}): Record<string, unknown>[] {
  const { view, overviewUrl, orgId, interruptionReason } = args;
  const rev = view.displayRevenueAtRisk ?? "—";
  const concern = view.slackPrimaryConcern.primary;
  const more =
    view.slackPrimaryConcern.moreCount > 0
      ? ` (+${view.slackPrimaryConcern.moreCount} more)`
      : "";

  const pending = view.readiness.filter((r) => r.status === "PENDING").map((r) => r.category);
  const missingLine =
    pending.length > 0 ? `Missing: ${escapeMrkdwn(pending.slice(0, 2).join(", "))}` : concern;

  const why =
    interruptionReason && interruptionReason.trim().length > 0
      ? `\n_Why this needs you:_ ${escapeMrkdwn(interruptionReason.trim().slice(0, 120))}`
      : "";

  const meta = JSON.stringify({ orgId, changeId: view.id });

  return [
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "_This is an executive decision. Domain approvals (Finance, Billing, etc.) are still required before release._",
        },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*${escapeMrkdwn(view.title)}*\n` +
          `Risk: *${view.riskLevel}* · Recommendation: *${recLabel(view.recommendation)}*\n` +
          `Revenue at risk: *${escapeMrkdwn(rev)}*\n` +
          `${escapeMrkdwn(missingLine)}${escapeMrkdwn(more)}` +
          why,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          style: "primary",
          text: { type: "plain_text", text: "Approve (exec)" },
          action_id: "executive_overlay_approve",
          value: meta,
        },
        {
          type: "button",
          style: "danger",
          text: { type: "plain_text", text: "Deny (exec)" },
          action_id: "executive_overlay_deny",
          value: meta,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Request info" },
          action_id: "executive_overlay_request_info",
          value: meta,
        },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Delay 24h" },
          action_id: "executive_overlay_delay",
          value: meta,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Escalate" },
          action_id: "executive_overlay_escalate",
          value: meta,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "View details" },
          url: overviewUrl,
        },
      ],
    },
  ];
}
