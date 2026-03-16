/**
 * Maps Jira status names to Solvren change statuses.
 * Uses canonical RG statuses from @/lib/changes/statuses.
 */
import { isValidRgStatus, type RgChangeStatus } from "@/lib/changes/statuses";

const DEFAULT_MAPPINGS: Record<string, RgChangeStatus> = {
  "To Do": "DRAFT",
  "In Progress": "DRAFT",
  "Ready for Review": "READY",
  "In Review": "IN_REVIEW",
  "Done": "APPROVED",
  "Rejected": "REJECTED",
};

export function mapJiraStatusToRg(
  jiraStatus: string,
  orgMappings: { jira_status: string; rg_status: string }[]
): RgChangeStatus | null {
  const custom = orgMappings.find(
    (m) => m.jira_status.toLowerCase() === jiraStatus.toLowerCase()
  );
  if (custom && isValidRgStatus(custom.rg_status)) return custom.rg_status;

  const def = DEFAULT_MAPPINGS[jiraStatus];
  if (def) return def;

  const byLower = Object.entries(DEFAULT_MAPPINGS).find(
    ([k]) => k.toLowerCase() === jiraStatus.toLowerCase()
  );
  return byLower ? byLower[1] : null;
}
