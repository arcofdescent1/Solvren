/**
 * Phase 5 — Cold-start service (§14, §24).
 * Determines when cold-start applies and injects safe fallbacks.
 */
import type { ActionPerformanceStatRow } from "../repositories/action-performance-stats.repository";

export type ColdStartRules = {
  coldStartMinSampleOrgFamily?: number;
  coldStartMinSampleOrg?: number;
};

const DEFAULT_MIN_ORG_FAMILY = 20;
const DEFAULT_MIN_ORG = 50;

export function shouldUseColdStart(
  orgId: string,
  issueFamily: string | null | undefined,
  statsByAction: Map<string, ActionPerformanceStatRow | null>,
  rules?: ColdStartRules | null
): boolean {
  const minFamily = rules?.coldStartMinSampleOrgFamily ?? DEFAULT_MIN_ORG_FAMILY;
  const minOrg = rules?.coldStartMinSampleOrg ?? DEFAULT_MIN_ORG;

  let orgFamilySamples = 0;
  let orgSamples = 0;

  for (const stat of statsByAction.values()) {
    if (!stat) continue;
    if (stat.org_id === orgId) {
      orgSamples += stat.sample_count;
      if (issueFamily && stat.issue_family === issueFamily) {
        orgFamilySamples += stat.sample_count;
      }
    }
  }

  if (orgFamilySamples >= minFamily) return false;
  if (orgSamples >= minOrg) return false;
  return true;
}
