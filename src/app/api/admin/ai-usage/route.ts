/**
 * Admin: AI usage stats (requests today, avg latency, rough cost) for Gap 4 cost control.
 */
import { NextResponse } from "next/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { hasPermissionInOrg } from "@/lib/rbac/can";
import { AuthzError, authzErrorResponse, requireVerifiedUser } from "@/lib/server/authz";

export async function GET() {
  try {
    const session = await requireVerifiedUser();
    const supabase = session.supabase;

    const { memberships } = await getActiveOrg(supabase, session.user.id);
    const active = memberships.find((m) => m.orgId);
    if (!active?.orgId) throw new AuthzError(403, "Forbidden");

    const allowed = await hasPermissionInOrg(
      supabase,
      session.user.id,
      active.orgId,
      "admin.jobs.view"
    );
    if (!allowed) throw new AuthzError(403, "Forbidden");

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const since = today.toISOString();

    const { data: rows, error } = await supabase
      .from("ai_requests")
      .select("id, latency_ms, status")
      .gte("created_at", since);

    if (error) {
      return NextResponse.json({
        requestsToday: 0,
        averageLatencyMs: null,
        estimatedCostCents: null,
        error: "ai_requests not available",
      });
    }

    const okRows = (rows ?? []).filter((r) => r.status === "ok" && r.latency_ms != null);
    const requestsToday = rows?.length ?? 0;
    const averageLatencyMs =
      okRows.length > 0
        ? Math.round(okRows.reduce((a, r) => a + (r.latency_ms ?? 0), 0) / okRows.length)
        : null;
    const estimatedCostCents =
      requestsToday > 0 ? Math.round((requestsToday * 0.0015 * 100)) / 100 : null;

    return NextResponse.json({
      requestsToday,
      averageLatencyMs,
      estimatedCostCents,
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
