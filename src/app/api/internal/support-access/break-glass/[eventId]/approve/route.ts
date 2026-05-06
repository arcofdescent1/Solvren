/**
 * POST /api/internal/support-access/break-glass/[eventId]/approve — employee approver activates break-glass.
 */
import { NextResponse } from "next/server";
import { requireInternalEmployeeApi } from "@/lib/internal/auth";
import { breakGlassApprovalsRequired } from "@/lib/server/access/break-glass-policy";
import {
  notifyOrgSupportAccessEvent,
  sanitizeSupportAccessReason,
} from "@/lib/server/access/support-access-notifications";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ eventId: string }> }) {
  const gate = await requireInternalEmployeeApi();
  if (!gate.ok) return gate.response;

  const { eventId } = await ctx.params;
  const { admin, user } = gate.ctx;

  const { data: ev, error: evErr } = await admin
    .from("break_glass_access_events")
    .select("id, org_id, severity, duration_minutes, activated_at, ended_at, reason, initiated_by_user_id")
    .eq("id", eventId)
    .maybeSingle();

  if (evErr || !ev) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const row = ev as {
    id: string;
    org_id: string;
    severity: string;
    duration_minutes: number;
    activated_at: string | null;
    ended_at: string | null;
    reason: string;
    initiated_by_user_id: string;
  };

  if (row.ended_at) return NextResponse.json({ error: "Event closed" }, { status: 400 });
  if (row.activated_at) return NextResponse.json({ error: "Already activated" }, { status: 400 });

  const required = breakGlassApprovalsRequired(row.severity as "high" | "critical");

  const { error: insErr } = await admin.from("break_glass_approvals").insert({
    event_id: row.id,
    approver_user_id: user.id,
  });

  if (insErr) {
    if (insErr.code === "23505") {
      return NextResponse.json({ error: "Already approved by this user" }, { status: 409 });
    }
    console.error("[break-glass/approve]", insErr.message);
    return NextResponse.json({ error: "Approve failed" }, { status: 500 });
  }

  const { data: approvers } = await admin
    .from("break_glass_approvals")
    .select("approver_user_id")
    .eq("event_id", row.id);

  const distinct = new Set((approvers ?? []).map((a) => (a as { approver_user_id: string }).approver_user_id));

  if (distinct.size < required) {
    return NextResponse.json({
      ok: true,
      activated: false,
      approvals: distinct.size,
      required,
    });
  }

  const activatedAt = new Date();
  const expiresAt = new Date(activatedAt.getTime() + row.duration_minutes * 60 * 1000);

  const { error: upErr } = await admin
    .from("break_glass_access_events")
    .update({
      activated_at: activatedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      customer_notified_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (upErr) {
    console.error("[break-glass/activate]", upErr.message);
    return NextResponse.json({ error: "Activation failed" }, { status: 500 });
  }

  const safeReason = sanitizeSupportAccessReason(row.reason);
  await notifyOrgSupportAccessEvent(admin, row.org_id, {
    title: "Emergency support access activated",
    body: `Solvren emergency access was used for your organization at ${activatedAt.toISOString()}. Reason: ${safeReason}. Expires at ${expiresAt.toISOString()}.`,
    dedupeKey: `support_access:break_glass:${row.id}:activated`,
  });

  return NextResponse.json({
    ok: true,
    activated: true,
    expiresAt: expiresAt.toISOString(),
  });
}
