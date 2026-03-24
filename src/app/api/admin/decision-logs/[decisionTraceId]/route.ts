/**
 * Phase 5 — GET /api/admin/decision-logs/:decisionTraceId (§22.2).
 */
import { NextRequest, NextResponse } from "next/server";
import { getDecisionLog } from "@/modules/decision/services/decision-engine.service";
import { authzErrorResponse, resolveResourceInOrg } from "@/lib/server/authz";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ decisionTraceId: string }> }
) {
  try {
    const { decisionTraceId } = await params;
    if (!decisionTraceId) {
      return NextResponse.json({ error: "decisionTraceId required" }, { status: 400 });
    }

    const ctx = await resolveResourceInOrg({
      table: "decision_logs",
      resourceId: decisionTraceId,
      permission: "admin.jobs.view",
    });

    const { data, error } = await getDecisionLog(ctx.supabase, decisionTraceId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Decision log not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    return authzErrorResponse(e);
  }
}
