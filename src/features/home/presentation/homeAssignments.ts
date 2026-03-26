import type { HomeWorkItem } from "./types";

export function getAssignedItems(items: HomeWorkItem[]) {
  return items.filter((item) => item.assignedToCurrentUser);
}
