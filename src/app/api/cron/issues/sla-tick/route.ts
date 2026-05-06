/**
 * Phase 2 — SLA warning (due within 24h) and breach (past due) notifications.
 * Idempotent via {@link enqueueIssueOutboxDeduped}.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/cronAuth";
import { enqueueIssueOutboxDeduped } from "@/services/notifications/issueOutboxDedupe";
import { OPEN_ISSUE_QUEUE_STATUSES } from "@/lib/issues/issuePhase2Types";
import { logInfo } from "@/lib/observability/logger";

const WARN_HOURS = 24;

export async function POST(req: Request) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  const admin = createAdminClient();
  const now = Date.now();
  const warnUntil = new Date(now + WARN_HOURS * 3600 * 1000).toISOString();

  const { data: warnCandidates, error: wErr } = await admin
    .from("issues")
    .select("id, org_id, sla_due_at, status, title")
    .not("sla_due_at", "is", null)
    .lte("sla_due_at", warnUntil)
    .gt("sla_due_at", new Date(now).toISOString())
    .limit(200);

  if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 });

  const { data: breachCandidates, error: bErr } = await admin
    .from("issues")
    .select("id, org_id, sla_due_at, status, title")
    .not("sla_due_at", "is", null)
    .lte("sla_due_at", new Date(now).toISOString())
    .limit(200);

  if (bErr) return NextResponse.json({ error: bErr.message }, { status: 500 });

  let enqueued = 0;

  const workloadStatuses = new Set<string>(OPEN_ISSUE_QUEUE_STATUSES);

  for (const row of warnCandidates ?? []) {
    const st = String((row as { status?: string }).status ?? "");
    if (!workloadStatuses.has(st)) continue;
    const issueId = (row as { id: string }).id;
    const orgId = (row as { org_id: string }).org_id;
    const slaDueAt = (row as { sla_due_at: string }).sla_due_at;
    const title = (row as { title?: string }).title ?? "";
    const { inserted } = await enqueueIssueOutboxDeduped(admin, {
      orgId,
      issueId,
      notificationType: "issue_sla_warning",
      channel: "IN_APP",
      templateKey: "issue_sla_warning",
      payload: {
        issueId,
        phase: "warn",
        slaDueAt,
        title,
      },
    });
    if (inserted) enqueued += 1;
  }

  for (const row of breachCandidates ?? []) {
    const st = String((row as { status?: string }).status ?? "");
    if (!workloadStatuses.has(st)) continue;
    const issueId = (row as { id: string }).id;
    const orgId = (row as { org_id: string }).org_id;
    const slaDueAt = (row as { sla_due_at: string }).sla_due_at;
    const title = (row as { title?: string }).title ?? "";
    const { inserted } = await enqueueIssueOutboxDeduped(admin, {
      orgId,
      issueId,
      notificationType: "issue_sla_breach",
      channel: "IN_APP",
      templateKey: "issue_sla_breach",
      payload: {
        issueId,
        phase: "breach",
        slaDueAt,
        title,
      },
    });
    if (inserted) enqueued += 1;
  }

  logInfo("cron.issue_sla_tick", { enqueued });
  return NextResponse.json({ ok: true, enqueued });
}
