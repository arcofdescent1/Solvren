export const METRIC_HELP = {
  revenue_at_risk:
    "An estimate of potential exposure based on currently open issues and changes most likely to affect revenue-critical workflows.",
  high_impact:
    "Used for items currently classified as likely to have meaningful business impact based on current signals and available exposure data.",
  review_coverage:
    "The share of relevant changes with review rules or approval coverage in place before release or follow-up.",
  monitoring_health:
    "A summary of whether Solvren is receiving timely signals and can reliably monitor configured systems.",
  detection_coverage:
    "The current breadth of systems, workflows, and change paths Solvren can meaningfully observe.",
  linked_to_issues:
    "Shows whether a change is associated with an active or recently resolved issue.",
  overdue:
    "Indicates an item has passed its expected review, follow-up, or resolution timing.",
  needs_details:
    "Used when Solvren is still missing important information needed to assess, route, or move an item forward.",
  delivery_issue:
    "Used when a notification, approval request, or related workflow message failed or still needs attention.",
  waiting_on_others:
    "Used when the next step depends on another person, team, or system rather than the current user.",
  roi_prevented:
    "Estimated prevented items are high-risk changes with intervention before impact and no downstream incident observed for 14 days.",
  roi_resolved:
    "Resolved includes issues in terminal states and issues with successful linked mitigation actions in the selected window.",
  roi_governed:
    "Governed high-risk changes are items classified as high risk with review intervention recorded before impact boundary.",
  roi_trend:
    "Compares current window estimates with the previous equal window to show directional improvement without claiming exact savings.",
} as const;

export type MetricHelpKey = keyof typeof METRIC_HELP;
