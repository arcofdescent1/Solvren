import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import { requireCronSecret } from "@/lib/cronAuth";
import { logError, logInfo } from "@/lib/observability/logger";

type Channel = "IN_APP" | "SLACK" | "EMAIL";

const DUE_SOON_HOURS = 4;
const ESCALATE_AFTER_HOURS = 24;

function computeSlaState(args: {
  now: Date;
  dueAt?: string | null;
  slaStatus?: string | null;
  escalatedAt?: string | null;
}): string {
  const { now, dueAt, slaStatus, escalatedAt } = args;
  if (slaStatus === "ESCALATED") return "ESCALATED";
  if (!dueAt) return "ON_TRACK";
  const due = new Date(dueAt);
  const ms = due.getTime() - now.getTime();
  const dueSoonMs = DUE_SOON_HOURS * 60 * 60 * 1000;
  const escalateAfterMs = ESCALATE_AFTER_HOURS * 60 * 60 * 1000;

  if (escalatedAt) return "ESCALATED";
  if (ms < 0) {
    const overdueMs = Math.abs(ms);
    if (overdueMs >= escalateAfterMs) return "ESCALATED";
    return "OVERDUE";
  }
  if (ms <= dueSoonMs) return "DUE_SOON";
  return "ON_TRACK";
}

async function ensureExecApprovals(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  args: { orgId: string; changeId: string }
): Promise<number> {
  const { orgId, changeId } = args;

  const { data: change, error: ceErr } = await supabase
    .from("change_events")
    .select("id, domain")
    .eq("id", changeId)
    .maybeSingle();
  if (ceErr || !change) return 0;

  const { data: existing, error } = await supabase
    .from("approvals")
    .select("id")
    .eq("change_event_id", changeId)
    .eq("approval_area", "EXEC");

  if (error) throw new Error(error.message);
  if ((existing ?? []).length > 0) return 0;

  const { data: members, error: memErr } = await supabase
    .from("organization_members")
    .select("user_id, role")
    .eq("org_id", orgId);

  if (memErr) throw new Error(memErr.message);

  const execPool = (members ?? [])
    .filter((m: { role?: string }) => String(m.role) === "EXEC")
    .map((m: { user_id: string }) => m.user_id);
  const adminPool = (members ?? [])
    .filter((m: { role?: string }) => ["owner", "admin"].includes(String(m.role ?? "").toLowerCase()))
    .map((m: { user_id: string }) => m.user_id);
  const anyPool = (members ?? []).map((m: { user_id: string }) => m.user_id);
  const pool = execPool.length ? execPool : adminPool.length ? adminPool : anyPool;

  const pick = pool.slice(0, 1);
  if (!pick.length) return 0;

  const domain = (change as { domain?: string }).domain ?? "REVENUE";
  const inserts = pick.map((uid: string) => ({
    change_event_id: changeId,
    org_id: orgId,
    domain,
    approver_user_id: uid,
    approval_area: "EXEC",
    decision: "PENDING",
  }));

  const { error: insErr } = await supabase.from("approvals").insert(inserts);
  if (insErr) throw new Error(insErr.message);
  return inserts.length;
}

function dayKeyUTC() {
  return new Date().toISOString().slice(0, 10);
}

async function enqueueSlaNotifications(params: {
  supabase: Awaited<ReturnType<typeof createAdminClient>>;
  orgId: string;
  domainKey: string;
  changeId: string;
  templateKey: string;
  payload: Record<string, unknown>;
}): Promise<{ inserted: number }> {
  const { supabase, orgId, domainKey, changeId, templateKey, payload } = params;

  const { data: settings } = await supabase
    .from("organization_settings")
    .select("slack_enabled, slack_webhook_url, email_enabled, notification_emails")
    .eq("org_id", orgId)
    .maybeSingle();

  const channels: Channel[] = ["IN_APP"];
  if (settings?.slack_enabled && settings?.slack_webhook_url)
    channels.push("SLACK");
  if (
    settings?.email_enabled &&
    Array.isArray(settings?.notification_emails) &&
    settings.notification_emails.length > 0
  ) {
    channels.push("EMAIL");
  }

  const dayKey = dayKeyUTC();
  const nowIso = new Date().toISOString();
  let inserted = 0;

  const dedupeBase =
    templateKey === "sla_overdue"
      ? `${templateKey}:${orgId}:${domainKey}:${changeId}:${dayKey}`
      : `${templateKey}:${orgId}:${domainKey}:${changeId}`;

  for (const ch of channels) {
    const dedupe_key = `${dedupeBase}:${ch.toLowerCase()}`;
    const row = {
      org_id: orgId,
      change_event_id: changeId,
      channel: ch,
      template_key: templateKey,
      payload,
      status: "PENDING",
      attempt_count: 0,
      last_error: null,
      available_at: nowIso,
      dedupe_key,
    };

    const { error } = await supabase.from("notification_outbox").insert(row);

    if (!error) {
      inserted += 1;
    } else {
      const code = String((error as { code?: string })?.code ?? "");
      const msg = String((error as { message?: string })?.message ?? "").toLowerCase();
      if (code === "23505" || msg.includes("duplicate")) {
        // Dedupe hit, safe to ignore
      } else {
        throw new Error(error.message);
      }
    }
  }

  return { inserted };
}

export async function POST(req: Request) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  const supabase = createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: changes, error: ceErr } = await supabase
    .from("change_events")
    .select(
      "id, org_id, status, due_at, sla_status, escalated_at, submitted_at, domain"
    )
    .eq("status", "IN_REVIEW")
    .limit(500);

  if (ceErr)
    return NextResponse.json({ error: ceErr.message }, { status: 500 });

  let scanned = 0;
  let transitioned = 0;
  let errors = 0;

  for (const c of changes ?? []) {
    scanned++;

    const prev = String(c.sla_status ?? "ON_TRACK");
    const next = computeSlaState({
      now,
      dueAt: c.due_at ?? null,
      slaStatus: c.sla_status ?? null,
      escalatedAt: c.escalated_at ?? null,
    });

    if (next === prev) continue;

    const { error: updErr } = await supabase
      .from("change_events")
      .update({
        sla_status: next,
        escalated_at: next === "ESCALATED" ? nowIso : c.escalated_at ?? null,
        last_notified_at: nowIso,
      })
      .eq("id", c.id);

    if (updErr)
      return NextResponse.json({ error: updErr.message }, { status: 500 });

    let execApprovalsCreated = 0;
    let execApprovalError: string | null = null;

    if (next === "ESCALATED") {
      try {
        execApprovalsCreated = await ensureExecApprovals(supabase, {
          orgId: c.org_id as string,
          changeId: c.id as string,
        });
      } catch (e) {
        execApprovalError =
          e instanceof Error ? e.message : "exec approval creation failed";
      }
    }

    const { error: evErr } = await supabase.from("sla_events").insert({
      org_id: c.org_id,
      change_event_id: c.id,
      previous_state: prev,
      new_state: next,
      triggered_by: null,
      triggered_source: "SYSTEM",
    });

    if (evErr)
      return NextResponse.json({ error: evErr.message }, { status: 500 });

    transitioned++;

    await auditLog(supabase, {
      orgId: c.org_id as string,
      actorId: null,
      actorType: "SYSTEM",
      action: "sla_state_changed",
      entityType: "change",
      entityId: c.id as string,
      metadata: {
        previous_state: prev,
        new_state: next,
        due_at: c.due_at ?? null,
        submitted_at: c.submitted_at ?? null,
      },
    });

    if (next === "ESCALATED") {
      await auditLog(supabase, {
        orgId: c.org_id as string,
        actorId: null,
        actorType: "SYSTEM",
        action: "escalation_triggered",
        entityType: "change",
        entityId: c.id as string,
        metadata: {
          previous_state: prev,
          new_state: next,
          exec_approvals_created: execApprovalsCreated,
        },
      });
    }

    if (next === "ESCALATED" && execApprovalError) {
      errors += 1;
      logError("sla.tick.escalation_exec_assignment_failed", new Error(execApprovalError), {
        changeId: c.id,
        orgId: c.org_id,
      });
      await auditLog(supabase, {
        orgId: c.org_id as string,
        actorId: null,
        actorType: "SYSTEM",
        action: "escalation_exec_assignment_failed",
        entityType: "change",
        entityId: c.id as string,
        metadata: { error: execApprovalError },
      });
    }

    const templateKey =
      next === "DUE_SOON"
        ? "sla_due_soon"
        : next === "OVERDUE"
          ? "sla_overdue"
          : next === "ESCALATED"
            ? "sla_escalated"
            : null;

    if (templateKey) {
      const domainKey = (c.domain ?? "REVENUE") as string;
      const { inserted } = await enqueueSlaNotifications({
        supabase,
        orgId: c.org_id as string,
        domainKey,
        changeId: c.id as string,
        templateKey,
        payload: {
          changeEventId: c.id,
          previous_state: prev,
          new_state: next,
          due_at: c.due_at ?? null,
          submitted_at: c.submitted_at ?? null,
          domain: c.domain ?? "REVENUE",
          at: nowIso,
        },
      });

      await auditLog(supabase, {
        orgId: c.org_id as string,
        actorId: null,
        actorType: "SYSTEM",
        action: "delivery_enqueued",
        entityType: "change",
        entityId: c.id as string,
        metadata: {
          template_key: templateKey,
          channels: inserted ? "MULTI" : "NONE",
        },
      });
    }
  }

  logInfo("sla.tick.completed", { scanned, transitioned, errors });

  return NextResponse.json({
    ok: true,
    scanned,
    transitioned,
    errors,
  });
}
