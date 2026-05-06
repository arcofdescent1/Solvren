/**
 * Phase 1 — issue_key: rolling UTC day bucket for deduplication.
 */
export function utcDayStartIso(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

export function buildIssueKey(orgId: string, source: string, type: string, windowDayUtc?: Date): string {
  const day = utcDayStartIso(windowDayUtc ?? new Date());
  return `${orgId}:${source}:${type}:${day}`;
}
