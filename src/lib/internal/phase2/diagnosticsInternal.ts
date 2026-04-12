/**
 * Phase 2 diagnostics aggregation (Resolution Appendix §3–§4).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const WINDOW_DAYS = 30;
const SUMMARY_MAX = 200;
const TIMELINE_DETAIL_MAX = 240;

function sinceIso(): string {
  return new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString();
}

function trunc(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n);
}

export async function buildDiagnosticsPayload(admin: SupabaseClient, orgId: string) {
  const since = sinceIso();

  const { data: failedRows } = await admin
    .from("notification_outbox")
    .select("id, channel, template_key, status, created_at, sent_at, delivered_at, attempt_count, change_event_id, dedupe_key, payload, last_error")
    .eq("org_id", orgId)
    .eq("status", "FAILED")
    .is("delivered_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(100);

  const failedNotifications = await filterNonSupersededFailed(admin, orgId, failedRows ?? []);

  const { data: escRows } = await admin
    .from("notification_outbox")
    .select("id, org_id, change_event_id, template_key, status, created_at, sent_at, payload")
    .eq("org_id", orgId)
    .eq("template_key", "escalation")
    .order("created_at", { ascending: false })
    .limit(50);

  const escalations = [];
  for (const row of escRows ?? []) {
    const id = String((row as { id: string }).id);
    const ceId = (row as { change_event_id: string | null }).change_event_id;
    let escalationStatus: "open" | "resolved" = "open";
    if (ceId) {
      const { data: ce } = await admin.from("change_events").select("status").eq("id", ceId).maybeSingle();
      const st = String((ce as { status?: string } | null)?.status ?? "").toUpperCase();
      if (st === "APPROVED" || st === "REJECTED" || st === "CLOSED" || st === "CANCELLED") escalationStatus = "resolved";
    }
    escalations.push({
      escalationId: id,
      entityType: "change_event",
      entityId: ceId,
      templateKey: (row as { template_key: string }).template_key,
      createdAt: (row as { created_at: string }).created_at,
      latestAttemptAt: (row as { sent_at: string | null }).sent_at ?? (row as { created_at: string }).created_at,
      owner: null,
      severity: "warning",
      escalationStatus,
    });
  }

  const recentErrors: Array<{
    timestamp: string;
    errorCategory: string;
    summary: string;
    component: string;
    severity: "info" | "warning" | "error" | "critical";
    entityRef: string | null;
  }> = [];

  for (const n of failedNotifications.slice(0, 20)) {
    recentErrors.push({
      timestamp: n.createdAt,
      errorCategory: "notification",
      summary: trunc(n.lastErrorSummary ?? "Notification failed", SUMMARY_MAX),
      component: "notification_outbox",
      severity: "error",
      entityRef: n.notificationId,
    });
  }

  const { count: wfFailed } = await admin
    .from("workflow_runs")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("run_status", ["failed", "FAILED"])
    .gte("started_at", since);

  const { count: detFailed } = await admin
    .from("detector_runs")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("status", ["failed", "FAILED"])
    .gte("started_at", since);

  const failedOperations = (wfFailed ?? 0) + (detFailed ?? 0);

  const { count: overdue } = await admin
    .from("change_events")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "IN_REVIEW")
    .not("due_at", "is", null)
    .lt("due_at", new Date().toISOString());

  const timeline: Array<{ at: string; type: string; detail: string }> = [];
  for (const n of failedNotifications.slice(0, 15)) {
    timeline.push({
      at: n.createdAt,
      type: "failed_notification",
      detail: trunc(`${n.channel} ${n.templateKey}`, TIMELINE_DETAIL_MAX),
    });
  }

  return {
    summary: {
      failedNotifications: failedNotifications.length,
      activeEscalations: escalations.filter((e) => e.escalationStatus === "open").length,
      overdueItems: overdue ?? 0,
      failedOperations,
      criticalErrors: recentErrors.filter((e) => e.severity === "critical").length,
    },
    failedNotifications,
    escalations,
    recentErrors,
    timeline,
  };
}

async function filterNonSupersededFailed(
  admin: SupabaseClient,
  orgId: string,
  rows: Record<string, unknown>[]
): Promise<
  Array<{
    notificationId: string;
    channel: string;
    templateKey: string;
    destination: string | null;
    status: string;
    createdAt: string;
    lastAttemptAt: string;
    attemptCount: number;
    relatedEntityType: string | null;
    relatedEntityId: string | null;
    lastErrorSummary: string | null;
  }>
> {
  const out: Array<{
    notificationId: string;
    channel: string;
    templateKey: string;
    destination: string | null;
    status: string;
    createdAt: string;
    lastAttemptAt: string;
    attemptCount: number;
    relatedEntityType: string | null;
    relatedEntityId: string | null;
    lastErrorSummary: string | null;
  }> = [];

  for (const r of rows) {
    const dedupe = (r.dedupe_key as string | null) ?? null;
    const ceId = (r.change_event_id as string | null) ?? null;
    const ch = String(r.channel ?? "");
    const created = String(r.created_at);
    if (dedupe) {
      const { data: newer } = await admin
        .from("notification_outbox")
        .select("id")
        .eq("org_id", orgId)
        .eq("dedupe_key", dedupe)
        .eq("channel", ch)
        .not("sent_at", "is", null)
        .gt("created_at", created)
        .limit(1)
        .maybeSingle();
      if (newer) continue;
    } else if (ceId) {
      const { data: newer } = await admin
        .from("notification_outbox")
        .select("id")
        .eq("org_id", orgId)
        .eq("change_event_id", ceId)
        .eq("channel", ch)
        .eq("template_key", String(r.template_key))
        .not("sent_at", "is", null)
        .gt("created_at", created)
        .limit(1)
        .maybeSingle();
      if (newer) continue;
    }

    out.push({
      notificationId: String(r.id),
      channel: ch,
      templateKey: String(r.template_key ?? ""),
      destination: null,
      status: String(r.status ?? "FAILED"),
      createdAt: created,
      lastAttemptAt: String(r.sent_at ?? r.created_at),
      attemptCount: Number(r.attempt_count ?? 1),
      relatedEntityType: ceId ? "change_event" : null,
      relatedEntityId: ceId,
      lastErrorSummary: r.last_error ? trunc(String(r.last_error), SUMMARY_MAX) : null,
    });
  }
  return out;
}
