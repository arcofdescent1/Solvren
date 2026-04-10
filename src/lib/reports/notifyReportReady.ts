import type { SupabaseClient } from "@supabase/supabase-js";

export async function notifyReportReady(args: {
  admin: SupabaseClient;
  orgId: string;
  reportId: string;
  requestingUserId: string | null;
  ok: boolean;
  errorMessage?: string;
}): Promise<void> {
  const { admin, orgId, reportId, requestingUserId, ok, errorMessage } = args;
  if (!requestingUserId) return;

  const dedupe_key = `outcomes_report:${reportId}:${ok ? "ok" : "fail"}:IN_APP`;
  const { error } = await admin.from("notification_outbox").insert({
    org_id: orgId,
    change_event_id: null,
    channel: "IN_APP",
    template_key: ok ? "outcomes_report_ready" : "outcomes_report_failed",
    payload: {
      reportId,
      recipientUserIds: [requestingUserId],
      errorMessage: errorMessage ?? null,
    },
    status: "PENDING",
    attempt_count: 0,
    last_error: null,
    available_at: new Date().toISOString(),
    dedupe_key,
  });
  if (error && !String(error.message).toLowerCase().includes("duplicate")) {
    // eslint-disable-next-line no-console
    console.warn("notifyReportReady:", error.message);
  }
}
