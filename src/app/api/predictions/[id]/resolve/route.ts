import { NextResponse } from "next/server";
import { createPrivilegedClient } from "@/lib/server/adminClient";
import { authzErrorResponse, requireOrgPermission } from "@/lib/server/authz";

export async function POST(_req: Request, routeContext: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await routeContext.params;
    const admin = createPrivilegedClient("POST /api/predictions/[id]/resolve");
    const { data: row } = await admin.from("predicted_risk_events").select("org_id").eq("id", id).maybeSingle();
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await requireOrgPermission((row as { org_id: string }).org_id, "change.approve");

    const now = new Date().toISOString();
    const { error } = await admin
      .from("predicted_risk_events")
      .update({ status: "RESOLVED", resolved_at: now })
      .eq("id", id)
      .in("status", ["ACTIVE", "ACKNOWLEDGED"]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
