import { NextRequest, NextResponse } from "next/server";
import { assertOrganizationExists } from "@/lib/internal/accountQueries";
import { logInternalAudit } from "@/lib/internal/audit";
import { requireInternalEmployeeApi } from "@/lib/internal/auth";
import { canAccessInternalTab, internalHasPermission } from "@/lib/internal/permissions";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; notificationId: string }> }
) {
  const gate = await requireInternalEmployeeApi();
  if (!gate.ok) return gate.response;

  const teamManage = internalHasPermission(gate.ctx.employeeRole, "internal.accounts.team.manage");
  if (!canAccessInternalTab(gate.ctx.employeeRole, "diagnostics", { teamManage })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!internalHasPermission(gate.ctx.employeeRole, "internal.accounts.diagnostics.remediate")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orgId, notificationId } = await params;
  let body: { reason?: string };
  try {
    body = (await req.json()) as { reason?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 8) {
    return NextResponse.json({ error: "reason must be at least 8 characters" }, { status: 400 });
  }

  const org = await assertOrganizationExists(gate.ctx.admin, orgId);
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = gate.ctx.admin;
  const { data: src } = await admin.from("notification_outbox").select("*").eq("id", notificationId).maybeSingle();
  if (!src || (src as { org_id: string }).org_id !== orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (String((src as { status: string }).status) !== "FAILED") {
    return NextResponse.json({ error: "Not retryable" }, { status: 409 });
  }
  if ((src as { delivered_at?: string | null }).delivered_at) {
    return NextResponse.json({ error: "Not retryable" }, { status: 409 });
  }

  const channel = String((src as { channel: string }).channel);
  const minuteWindow = Math.floor(Date.now() / 60000);
  const dedupe = `manual-retry:${notificationId}:${channel}:${minuteWindow}`;
  const { data: pending } = await admin
    .from("notification_outbox")
    .select("id")
    .eq("dedupe_key", dedupe)
    .in("status", ["PENDING", "PROCESSING", "QUEUED"])
    .limit(1)
    .maybeSingle();
  if (pending) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  const payload = {
    ...((src as { payload: Record<string, unknown> }).payload ?? {}),
    retryOfNotificationId: notificationId,
    requestedByEmployeeUserId: gate.ctx.user.id,
    requestedByEmployeeEmail: gate.ctx.emailLower,
  };

  const { error: insErr } = await admin.from("notification_outbox").insert({
    org_id: orgId,
    change_event_id: (src as { change_event_id: string | null }).change_event_id,
    channel,
    template_key: String((src as { template_key: string }).template_key),
    payload,
    status: "PENDING",
    attempt_count: 0,
    dedupe_key: dedupe,
    available_at: new Date().toISOString(),
  });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  await logInternalAudit(admin, {
    employeeUserId: gate.ctx.user.id,
    employeeEmail: gate.ctx.emailLower,
    employeeRole: gate.ctx.employeeRole,
    orgId,
    action: "internal.notification.retry.requested",
    targetType: "notification_outbox",
    targetId: notificationId,
    reason,
    metadata: { dedupe },
  });

  return NextResponse.json({ ok: true, status: "queued" });
}
