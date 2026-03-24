import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { runRevenueImpactGeneration } from "@/services/revenueImpact/runRevenueImpactGeneration";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: changeId } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: orgRow } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const orgId = orgRow?.org_id as string | undefined;
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 400 });

  const { data: change, error: chErr } = await scopeActiveChangeEvents(supabase.from("change_events").select("*"))
    .eq("id", changeId)
    .maybeSingle();
  if (chErr) return NextResponse.json({ error: chErr.message }, { status: 500 });
  if (!change) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("org_id", change.org_id)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { saved } = await runRevenueImpactGeneration({
      supabase,
      orgId,
      changeId,
      actorUserId: userRes.user.id,
      regenerate: true,
    });
    return NextResponse.json({
      ok: true,
      version: saved.version,
      report: saved.report_json,
      model: saved.model_name,
      generated_by: saved.generated_by,
      risk_level: saved.risk_level,
      risk_score: saved.risk_score,
      confidence_score: saved.confidence_score,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Revenue impact generation failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
