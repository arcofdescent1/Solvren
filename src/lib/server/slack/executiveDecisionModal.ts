import type { ExecutiveDecisionApi } from "@/lib/executive/types";

export type ExecutiveModalMeta = { orgId: string; changeId: string; decision: ExecutiveDecisionApi };

/** Slack modal view payload for executive overlay decisions (DM + interactive). */
export function buildExecutiveDecisionSlackModal(args: { meta: ExecutiveModalMeta }): Record<string, unknown> {
  const { meta } = args;
  const { decision } = meta;

  const titles: Record<ExecutiveDecisionApi, string> = {
    APPROVE: "Executive sign-off",
    DENY: "Executive block",
    DELAY: "Delay 24 hours",
    ESCALATE: "Escalate",
    REQUEST_INFO: "Request information",
  };

  const intros: Record<ExecutiveDecisionApi, string> = {
    APPROVE:
      "*Executive approval*\nRecords directional leadership sign-off. Domain approvals (Finance, Billing, etc.) and evidence are still required before release.",
    DENY:
      "*Executive deny*\nThis blocks the change from an executive perspective (`executive_blocked`). Domain approval rows are not modified.",
    DELAY:
      "*Delay 24h*\nSnoozes executive reminders for 24 hours and sets a follow-up time. Does not pause domain approvals.",
    ESCALATE: "*Escalate*\nRecords executive escalation for visibility. Add context below (required).",
    REQUEST_INFO:
      "*Request information*\nCreates a timeline event and notifies the change owner. Does not change domain approval states.",
  };

  const blocks: Record<string, unknown>[] = [
    {
      type: "section",
      text: { type: "mrkdwn", text: intros[decision] },
    },
  ];

  if (decision === "APPROVE") {
    blocks.push({
      type: "input",
      block_id: "ack_block",
      optional: true,
      label: { type: "plain_text", text: "Acknowledgement" },
      element: {
        type: "checkboxes",
        action_id: "ack",
        options: [
          {
            text: {
              type: "plain_text",
              text: "I understand domain approvals and evidence still apply before release.",
            },
            value: "yes",
          },
        ],
      },
    });
  }

  const commentOptional = decision === "APPROVE" || decision === "DELAY";
  blocks.push({
    type: "input",
    block_id: "comment",
    optional: commentOptional,
    label: {
      type: "plain_text",
      text:
        decision === "APPROVE"
          ? "Optional note"
          : decision === "DELAY"
            ? "Optional note"
            : "Comment",
    },
    element: {
      type: "plain_text_input",
      action_id: "value",
      multiline: true,
    },
  });

  return {
    type: "modal",
    callback_id: "executive_decision_modal",
    private_metadata: JSON.stringify(meta),
    title: { type: "plain_text", text: titles[decision] },
    submit: { type: "plain_text", text: "Submit" },
    close: { type: "plain_text", text: "Cancel" },
    blocks,
  };
}
