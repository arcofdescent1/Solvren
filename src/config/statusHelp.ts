export const STATUS_HELP = {
  needs_review:
    "This item is waiting on a decision, approval, or input before it can move forward.",
  needs_details:
    "Important information is still missing, so Solvren cannot fully assess or route this item yet.",
  on_track:
    "The item is currently moving forward without an active blocker requiring attention.",
  overdue:
    "This item has passed its expected timing for review, follow-up, or resolution.",
  delivery_issue:
    "A related notification or approval request failed or still needs follow-up.",
  waiting_on_others:
    "The next step depends on another person, team, or system.",
  monitoring:
    "Solvren is currently watching this item or workflow, and no immediate user action is needed.",
  no_action_needed:
    "There is no immediate follow-up required from you at this time.",
  verified:
    "The issue or action has been reviewed and is currently considered resolved or confirmed.",
} as const;

export type StatusHelpKey = keyof typeof STATUS_HELP;
