import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canViewChange } from "@/lib/access/changeAccess";
import { buildCoordinationInput } from "@/services/coordination/buildCoordinationInput";

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
    .from("coordination_plans")
    .select("*")
    .eq("change_id", changeId)
    .eq("is_current", true)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ ok: true, plan: null, stale: false });

  const input = await buildCoordinationInput({ supabase, changeId });
  const stale = String(row.input_hash ?? "") !== input.inputHash;
  return NextResponse.json({
    ok: true,
    plan: row.plan_json,
    stale,
    generated_at: row.created_at,
    version: row.version,
    generated_by: row.generated_by,
    status: row.status,
  });
}
