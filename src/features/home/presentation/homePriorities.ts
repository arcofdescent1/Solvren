import type { HomeWorkItem } from "./types";

function score(item: HomeWorkItem) {
  return (
    (item.assignedToCurrentUser ? 1000 : 0) +
    (item.overdue ? 700 : 0) +
    (item.highImpact ? 500 : 0) +
    (item.linkedToActiveIssue ? 350 : 0) +
    (item.blocked ? 250 : 0) +
    (item.retryRequired ? 200 : 0) +
    (item.rankBoost ?? 0)
  );
}

export function getTopPriorities(items: HomeWorkItem[], cap = 5) {
  return [...items].sort((a, b) => score(b) - score(a)).slice(0, cap);
}
