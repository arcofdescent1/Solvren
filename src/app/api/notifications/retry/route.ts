import { NextResponse } from "next/server";
import { auditLog } from "@/lib/audit";
import { hasPermissionInOrg } from "@/lib/rbac/can";
import { notificationRetryBodySchema } from "@/lib/server/apiSchemas";
import { authzErrorResponse, requireVerifiedUser } from "@/lib/server/authz";

export const maxDuration = 15;

export async function POST(req: Request) {
  try {
    const session = await requireVerifiedUser();
    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = notificationRetryBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
    }
    const { outboxId } = parsed.data;

    const { data: row, error: rErr } = await session.supabase
      .from("notification_outbox")
      .select("id, org_id, status")
      .eq("id", outboxId)
      .maybeSingle();

    if (rErr || !row) {
      return NextResponse.json({ error: rErr?.message ?? "Not found" }, { status: 404 });
    }

    const orgId = String((row as { org_id?: string }).org_id ?? "");
    const allowed = await hasPermissionInOrg(session.supabase, session.user.id, orgId, "queue.admin.view");
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if ((row as { status?: string }).status !== "FAILED") {
      return NextResponse.json({ error: "Only FAILED notifications can be retried." }, { status: 400 });
    }

    const { error: updErr } = await session.supabase
      .from("notification_outbox")
      .update({
        status: "PENDING",
        attempt_count: 0,
        last_error: null,
        available_at: new Date().toISOString(),
      })
      .eq("id", outboxId);

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    await auditLog(session.supabase, {
      orgId,
      actorId: session.user.id,
      action: "notification.retry_requested",
      entityType: "notification_outbox",
      entityId: outboxId,
      metadata: {},
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
