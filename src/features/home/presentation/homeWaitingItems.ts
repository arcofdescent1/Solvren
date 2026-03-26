import type { HomeWorkItem } from "./types";

export function getWaitingItems(items: HomeWorkItem[]) {
  return items.filter((item) => item.blocked && !item.assignedToCurrentUser);
}
