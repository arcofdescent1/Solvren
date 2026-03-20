/**
 * Phase 8 — POST /api/admin/autonomy/simulations, GET list.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership?.org_id) return NextResponse.json({ error: "No org" }, { status: 403 });

  const { data: runs, error } = await supabase
    .from("simulation_runs")
    .select("*")
    .eq("org_id", membership.org_id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ simulations: runs ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership?.org_id) return NextResponse.json({ error: "No org" }, { status: 403 });

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

  const { data: sim, error } = await supabase
    .from("simulation_runs")
    .insert({
      org_id: membership.org_id,
      simulation_type: body.simulation_type ?? "playbook_backtest",
      scope_json: { playbook_id: body.playbook_definition_id },
      playbook_definition_id: body.playbook_definition_id ?? null,
      policy_set_snapshot_json: {},
      historical_window_start: start.toISOString(),
      historical_window_end: end.toISOString(),
      status: "queued",
      created_by_user_id: userRes.user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ simulation: sim, message: "Simulation queued" });
}
