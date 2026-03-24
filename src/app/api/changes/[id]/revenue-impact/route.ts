import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canViewChange } from "@/lib/access/changeAccess";
import { buildRevenueImpactInput } from "@/services/revenueImpact/buildRevenueImpactInput";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: changeId } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: change, error: chErr } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, org_id, domain, status, created_by, is_restricted"))
    .eq("id", changeId)
    .maybeSingle();
  if (chErr) return NextResponse.json({ error: chErr.message }, { status: 500 });
  if (!change) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed = await canViewChange(supabase, userRes.user.id, change);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: row, error } = await supabase
    .from("revenue_impact_reports")
    .select("*")
    .eq("change_id", changeId)
    .eq("is_current", true)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ ok: true, report: null, stale: false });

  const input = await buildRevenueImpactInput({ supabase, changeId });
  const stale = String(row.input_hash ?? "") !== input.inputHash;

  return NextResponse.json({
    ok: true,
    report: row.report_json,
    stale,
    generated_at: row.created_at,
    generated_by: row.generated_by,
    version: row.version,
    risk_score: row.risk_score,
    risk_level: row.risk_level,
    confidence_score: row.confidence_score,
    status: row.status,
    model_name: row.model_name,
    prompt_version: row.prompt_version,
  });
}
