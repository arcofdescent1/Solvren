import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canViewChange } from "@/lib/access/changeAccess";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: changeId } = await ctx.params;
  const { data: change } = await supabase
    .from("change_events")
    .select("id, org_id, domain, status, created_by, is_restricted")
    .eq("id", changeId)
    .maybeSingle();
  if (!change) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const allowed = await canViewChange(supabase, userRes.user.id, change);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("change_evidence_items")
    .select("id, kind, label, severity, status, note, url, provided_at, provided_by, created_at")
    .eq("change_event_id", changeId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, items: data ?? [] });
}
