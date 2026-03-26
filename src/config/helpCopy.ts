export const HELP_COPY = {
  sections: {
    todays_priorities:
      "The most important items to review, resolve, or follow up on right now.",
    assigned_to_me:
      "Work that currently needs your review, decision, or follow-up.",
    waiting_on_others:
      "Items moving forward, but currently blocked on another person, team, or system.",
    revenue_at_risk:
      "Estimated exposure based on active issues and changes that could affect revenue-critical workflows.",
    protection:
      "Monitoring, integrations, and review coverage that help Solvren catch issues and risky changes before they become bigger problems.",
    recent_activity:
      "Important changes, detections, approvals, and follow-up activity from across Solvren.",
    go_next: "Choose the path that fits what you need to do.",
    changes_filters:
      "Use filters to narrow to the items you can act on fastest. Advanced fields explain how Solvren determines each state.",
  },
  whySurfaced: {
    overdue_assigned: "Surfaced because it is overdue and assigned to you.",
    awaiting_review: "Surfaced because it is awaiting your review.",
    linked_issue: "Surfaced because it is linked to an active issue.",
    missing_details:
      "Surfaced because supporting details are still missing.",
    delivery_problem:
      "Surfaced because delivery follow-up is still needed.",
  },
  workflowNext: {
    needs_details:
      "Once supporting details are added, Solvren will reassess this item and move it through the normal workflow.",
    delivery_issue:
      "When delivery succeeds, this item returns to on-track. If delivery keeps failing, it may require manual follow-up.",
    waiting_on_others:
      "When the blocking dependency is resolved, Solvren will update status and route next actions automatically.",
  },
} as const;

export const DOCS_LINKS = {
  revenue_estimation: null,
  review_coverage: null,
  integration_mapping: "/integrations/mappings",
  approval_policies: "/settings/policies",
  governance_workflow: "/insights/governance-reports",
} as const;

export type DocsConceptKey = keyof typeof DOCS_LINKS;
