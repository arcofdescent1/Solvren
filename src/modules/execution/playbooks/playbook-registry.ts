/**
 * Phase 6 Deep Expansion — Execution playbooks (§14).
 * Productized intelligence: Failed Payment, Unworked Lead, etc.
 */

export type PlaybookStep = {
  order: number;
  actionKey: string;
  condition?: "always" | "on_failure" | "on_success";
  paramsFromIssue?: Record<string, string>; // Map issue fields to action params
};

export type PlaybookDefinition = {
  playbookKey: string;
  displayName: string;
  description: string;
  triggerDomain: string;
  triggerSourceType?: string;
  steps: PlaybookStep[];
};

export const BUILTIN_PLAYBOOKS: PlaybookDefinition[] = [
  {
    playbookKey: "failed_payment_recovery",
    displayName: "Failed Payment Recovery",
    description: "1. Retry payment (auto) → 2. If fail, send email → 3. If fail, create task → 4. Flag churn risk",
    triggerDomain: "revenue",
    triggerSourceType: "detector",
    steps: [
      { order: 1, actionKey: "stripe.retry_payment", condition: "always" },
      { order: 2, actionKey: "stripe.update_payment_method", condition: "on_failure" },
      { order: 3, actionKey: "hubspot.create_task", condition: "on_failure" },
      { order: 4, actionKey: "slack.post_issue_summary", condition: "on_failure" },
    ],
  },
  {
    playbookKey: "unworked_lead_recovery",
    displayName: "Unworked Lead Recovery",
    description: "1. Assign owner → 2. Create task → 3. Notify manager → 4. Escalate if untouched 24h",
    triggerDomain: "revenue",
    triggerSourceType: "detector",
    steps: [
      { order: 1, actionKey: "hubspot.assign_owner", condition: "always" },
      { order: 2, actionKey: "hubspot.create_task", condition: "always" },
      { order: 3, actionKey: "slack.post_issue_summary", condition: "always" },
    ],
  },
];

export function getPlaybookByKey(playbookKey: string): PlaybookDefinition | undefined {
  return BUILTIN_PLAYBOOKS.find((p) => p.playbookKey === playbookKey);
}

export function getPlaybooksForDomain(domain: string): PlaybookDefinition[] {
  return BUILTIN_PLAYBOOKS.filter((p) => p.triggerDomain === domain || p.triggerDomain === "*");
}
