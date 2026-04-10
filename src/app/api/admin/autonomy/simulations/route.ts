/**
 * Phase 8 — POST /api/admin/autonomy/simulations, GET list.
 */
import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

export async function GET(_req: NextRequest) {
  try {
    const ctx = await requireAnyOrgPermission("admin.simulations.manage");

    const { data: runs, error } = await ctx.supabase
      .from("simulation_runs")
      .select("*")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ simulations: runs ?? [] });
  } catch (e) {
    return authzErrorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAnyOrgPermission("admin.simulations.manage");

    let body: {
      simulation_type: string;
      playbook_definition_id?: string | null;
      historical_days?: number;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const days = body.historical_days ?? 30;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);

    const { data: sim, error } = await ctx.supabase
      .from("simulation_runs")
      .insert({
        org_id: ctx.orgId,
        simulation_type: body.simulation_type ?? "playbook_backtest",
        scope_json: { playbook_id: body.playbook_definition_id },
        playbook_definition_id: body.playbook_definition_id ?? null,
        policy_set_snapshot_json: {},
        historical_window_start: start.toISOString(),
        historical_window_end: end.toISOString(),
        status: "queued",
        created_by_user_id: ctx.user.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ simulation: sim, message: "Simulation queued" });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
