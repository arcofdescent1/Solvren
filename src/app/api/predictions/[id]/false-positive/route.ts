import { NextResponse } from "next/server";
import { createPrivilegedClient } from "@/lib/server/adminClient";
import { authzErrorResponse, requireOrgPermission } from "@/lib/server/authz";

export async function POST(_req: Request, routeContext: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await routeContext.params;
    const admin = createPrivilegedClient("POST /api/predictions/[id]/false-positive");
    const { data: row } = await admin
      .from("predicted_risk_events")
      .select("org_id, change_event_id, prediction_type, root_cause_hash")
      .eq("id", id)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const r = row as {
      org_id: string;
      change_event_id: string;
      prediction_type: string;
      root_cause_hash: string;
    };
    await requireOrgPermission(r.org_id, "change.approve");

    const now = new Date().toISOString();
    const until = new Date(Date.now() + 30 * 86400000).toISOString();

    await admin.from("predicted_risk_events").update({ status: "FALSE_POSITIVE", resolved_at: now }).eq("id", id);

    await admin.from("prediction_suppressions").upsert(
      {
        org_id: r.org_id,
        change_event_id: r.change_event_id,
        prediction_type: r.prediction_type,
        root_cause_hash: r.root_cause_hash,
        until,
      },
      { onConflict: "org_id,change_event_id,prediction_type,root_cause_hash" }
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
