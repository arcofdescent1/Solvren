/**
 * Shared issue status tab model — safe for Server Components.
 * Keep pure helpers out of "use client" files so pages can call them during SSR.
 */

export type IssueStatusTabDef = { key: string; label: string; statuses: string[] };

export const ISSUE_STATUS_TAB_DEFS: IssueStatusTabDef[] = [
  { key: "open", label: "Open", statuses: ["open", "triaged", "assigned", "in_progress"] },
  { key: "assigned", label: "Assigned", statuses: ["assigned", "in_progress"] },
  { key: "pending_verification", label: "Pending verification", statuses: ["resolved"] },
  { key: "verified", label: "Verified", statuses: ["verified"] },
  { key: "dismissed", label: "Dismissed", statuses: ["dismissed"] },
];

export function getStatusTabFromParam(statusParam: string | null): string {
  if (!statusParam) return "open";
  const t = ISSUE_STATUS_TAB_DEFS.find((tab) => tab.key === statusParam);
  return t?.key ?? "open";
}

export function getStatusesForTab(tabKey: string): string[] {
  const t = ISSUE_STATUS_TAB_DEFS.find((tab) => tab.key === tabKey);
  return t?.statuses ?? ISSUE_STATUS_TAB_DEFS[0].statuses;
}
