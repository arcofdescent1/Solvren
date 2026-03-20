/**
 * Phase 2 — POST /api/admin/simulations/compare
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { compareSimulationRuns } from "@/modules/simulation/services/simulation-orchestrator.service";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .limit(1)
    .maybeSingle();
  if (!membership?.org_id) return NextResponse.json({ error: "No org" }, { status: 403 });

  const orgId = (membership as { org_id: string }).org_id;

  let body: { baselineRunId?: string; candidateRunId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { baselineRunId, candidateRunId } = body;
  if (!baselineRunId || !candidateRunId) {
    return NextResponse.json({ error: "baselineRunId and candidateRunId required" }, { status: 400 });
  }

  const { data, error } = await compareSimulationRuns(supabase, orgId, baselineRunId, candidateRunId);
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json(data);
}
