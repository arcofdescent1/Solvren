import type { HomeActivityItem } from "./types";

const ALLOWED_ACTIONS = [
  "issue.detected",
  "change.declared",
  "approval.completed",
  "change.overdue",
  "details.added",
  "notification.retry_succeeded",
  "issue.verified_resolved",
];

export function filterMeaningfulActivity(items: HomeActivityItem[]) {
  return items.filter((item) =>
    ALLOWED_ACTIONS.some((action) => item.id.includes(action) || item.title.toLowerCase().includes(action.split(".")[0]))
  );
}
