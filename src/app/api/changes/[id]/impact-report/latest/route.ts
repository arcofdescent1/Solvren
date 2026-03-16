/**
 * @deprecated Use GET /api/changes/[id]/revenue-impact instead (canonical).
 * This route remains for backward compatibility. TODO: remove in future release.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildRevenueImpactInput } from "@/services/revenueImpact/buildRevenueImpactInput";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: changeId } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: row, error } = await supabase
    .from("revenue_impact_reports")
    .select("*")
    .eq("change_id", changeId)
    .eq("is_current", true)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ ok: true, report: null });

  const input = await buildRevenueImpactInput({ supabase, changeId });
  const stale = String(row.input_hash ?? "") !== input.inputHash;

  return NextResponse.json({
    ok: true,
    report: row.report_json,
    stale,
    meta: {
      version: row.version,
      model: row.model_name,
      confidence: row.confidence_score,
      created_at: row.created_at,
      generated_by: row.generated_by,
      prompt_version: row.prompt_version,
      risk_level: row.risk_level,
      risk_score: row.risk_score,
    },
  });
}
