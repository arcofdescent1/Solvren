import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Incidents after corrective action through observation end (Phase 6).
 * Sources: failed launch label, FAILED status, rollback execution signals, linked high/critical issues.
 */
export async function hasDownstreamIncident(args: {
  admin: SupabaseClient;
  changeEventId: string;
  afterActionAt: string;
  windowEnd: string;
}): Promise<boolean> {
  const { admin, changeEventId, afterActionAt, windowEnd } = args;
  const t0 = new Date(afterActionAt).getTime();
  const t1 = new Date(windowEnd).getTime();

  const { data: change } = await admin
    .from("change_events")
    .select("status, failed_launch_labeled_at")
    .eq("id", changeEventId)
    .maybeSingle();
  const ch = change as { status?: string; failed_launch_labeled_at?: string | null } | null;
  if (ch) {
    const st = String(ch.status ?? "").toUpperCase();
    if (st === "FAILED") return true;
    if (ch.failed_launch_labeled_at) {
      const fl = new Date(ch.failed_launch_labeled_at).getTime();
      if (fl >= t0 && fl <= t1) return true;
    }
  }

  const { data: events } = await admin
    .from("change_timeline_events")
    .select("event_type, created_at")
    .eq("change_event_id", changeEventId)
    .gte("created_at", new Date(t0).toISOString())
    .lte("created_at", new Date(t1).toISOString());

  for (const ev of events ?? []) {
    const et = String((ev as { event_type?: string }).event_type ?? "").toUpperCase();
    if (et.includes("ROLLBACK") && !et.includes("PLAN") && !et.includes("EVIDENCE")) {
      return true;
    }
    if (et.includes("FAILED") || et.includes("OUTAGE") || et.includes("INCIDENT")) {
      return true;
    }
  }

  const { data: links } = await admin
    .from("change_issue_links")
    .select("issue_id")
    .eq("change_id", changeEventId);
  const issueIds = (links ?? []).map((l) => (l as { issue_id: string }).issue_id);
  if (issueIds.length === 0) return false;

  const { data: issues } = await admin
    .from("issues")
    .select("id, created_at, severity, status")
    .in("id", issueIds);
  for (const iss of issues ?? []) {
    const row = iss as {
      created_at?: string;
      severity?: string;
      status?: string;
    };
    if (!row.created_at) continue;
    const ic = new Date(row.created_at).getTime();
    if (ic < t0 || ic > t1) continue;
    const sev = String(row.severity ?? "").toLowerCase();
    const ist = String(row.status ?? "").toLowerCase();
    if ((sev === "high" || sev === "critical") && ist !== "dismissed" && ist !== "verified") {
      return true;
    }
  }

  return false;
}
