import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { explainRiskScore } from "@/services/ai/riskExplain";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: changeId } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: change, error: chErr } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, org_id"))
    .eq("id", changeId)
    .maybeSingle();

  if (chErr) return NextResponse.json({ error: chErr.message }, { status: 500 });
  if (!change) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orgId = (change as { org_id: string }).org_id;

  const { data: member } = await supabase
    .from("organization_members")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const out = await explainRiskScore(supabase, { changeId });
    return NextResponse.json(out);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to explain risk" },
      { status: 500 }
    );
  }
}
