/**
 * Phase 1 — scheduled data retention using `data_retention_policies` + safe defaults.
 * Must run with a service-role / privileged client only (cron, manual ops).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const RETENTION_RESOURCE_TYPES = ["audit_log", "notification_outbox", "change_events_tombstone"] as const;
export type RetentionResourceType = (typeof RETENTION_RESOURCE_TYPES)[number];

const DEFAULT_RETENTION_DAYS: Record<RetentionResourceType, number> = {
  audit_log: 365,
  notification_outbox: 90,
  change_events_tombstone: 30,
};

type PolicyRow = {
  org_id: string;
  resource_type: string;
  retention_days: number;
  enabled: boolean;
};

export type DataRetentionSweepResult = {
  orgsProcessed: number;
  auditLogDeleted: number;
  notificationOutboxDeleted: number;
  changeEventsHardDeleted: number;
  errors: string[];
};

/** Exported for unit tests — UTC day-based cutoff. */
export function cutoffIsoFromRetentionDays(days: number, now: Date = new Date()): string {
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function retentionDaysForOrg(
  orgId: string,
  resourceType: RetentionResourceType,
  policiesByOrg: Map<string, Map<string, number>>
): number {
  const days = policiesByOrg.get(orgId)?.get(resourceType);
  if (days != null && Number.isFinite(days) && days > 0) {
    return Math.min(Math.floor(days), 3650);
  }
  return DEFAULT_RETENTION_DAYS[resourceType];
}

/**
 * Purge old rows per org. Notification outbox: only terminal rows (sent or terminal status),
 * never in-flight PENDING/PROCESSING.
 */
export async function runDataRetentionSweep(
  admin: SupabaseClient,
  opts?: { now?: Date; maxOrgs?: number }
): Promise<DataRetentionSweepResult> {
  const now = opts?.now ?? new Date();
  const maxOrgs = opts?.maxOrgs ?? 2000;

  const result: DataRetentionSweepResult = {
    orgsProcessed: 0,
    auditLogDeleted: 0,
    notificationOutboxDeleted: 0,
    changeEventsHardDeleted: 0,
    errors: [],
  };

  const { data: policyRows, error: polErr } = await admin
    .from("data_retention_policies")
    .select("org_id, resource_type, retention_days, enabled")
    .eq("enabled", true);

  if (polErr) {
    result.errors.push(`data_retention_policies: ${polErr.message}`);
    return result;
  }

  const policiesByOrg = new Map<string, Map<string, number>>();
  for (const raw of policyRows ?? []) {
    const row = raw as PolicyRow;
    if (!row.org_id || !row.resource_type) continue;
    if (!policiesByOrg.has(row.org_id)) policiesByOrg.set(row.org_id, new Map());
    policiesByOrg.get(row.org_id)!.set(row.resource_type, row.retention_days);
  }

  const { data: orgRows, error: orgErr } = await admin.from("organizations").select("id").limit(maxOrgs);

  if (orgErr) {
    result.errors.push(`organizations: ${orgErr.message}`);
    return result;
  }

  const orgIds = (orgRows ?? []).map((o) => String((o as { id: string }).id)).filter(Boolean);

  for (const orgId of orgIds) {
    result.orgsProcessed += 1;

    const auditCutoff = cutoffIsoFromRetentionDays(retentionDaysForOrg(orgId, "audit_log", policiesByOrg), now);
    const {
      error: aErr,
      count: aCount,
    } = await admin.from("audit_log").delete({ count: "exact" }).eq("org_id", orgId).lt("created_at", auditCutoff);
    if (aErr) result.errors.push(`audit_log org=${orgId}: ${aErr.message}`);
    else result.auditLogDeleted += aCount ?? 0;

    const outboxCutoff = cutoffIsoFromRetentionDays(
      retentionDaysForOrg(orgId, "notification_outbox", policiesByOrg),
      now
    );
    const {
      error: oErr,
      count: oCount,
    } = await admin
      .from("notification_outbox")
      .delete({ count: "exact" })
      .eq("org_id", orgId)
      .lt("created_at", outboxCutoff)
      .or("sent_at.not.is.null,status.eq.SENT,status.eq.FAILED");
    if (oErr) result.errors.push(`notification_outbox org=${orgId}: ${oErr.message}`);
    else result.notificationOutboxDeleted += oCount ?? 0;

    const tombstoneCutoff = cutoffIsoFromRetentionDays(
      retentionDaysForOrg(orgId, "change_events_tombstone", policiesByOrg),
      now
    );
    const {
      error: cErr,
      count: cCount,
    } = await admin
      .from("change_events")
      .delete({ count: "exact" })
      .eq("org_id", orgId)
      .not("deleted_at", "is", null)
      .lt("deleted_at", tombstoneCutoff);
    if (cErr) result.errors.push(`change_events hard-delete org=${orgId}: ${cErr.message}`);
    else result.changeEventsHardDeleted += cCount ?? 0;
  }

  return result;
}
