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

  const { data: change, error: chErr } = await supabase
    .from("change_events")
    .select("id, org_id, domain, status, created_by, is_restricted")
    .eq("id", changeId)
    .single();

  if (chErr || !change)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed = await canViewChange(supabase, userRes.user.id, change);
  if (!allowed)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: events, error } = await supabase
    .from("change_timeline_events")
    .select("id, actor_user_id, event_type, title, description, metadata, created_at")
    .eq("change_event_id", changeId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const currentUserId = userRes.user.id;

  const rows = (events ?? []).map((e) => ({
    id: e.id,
    actor_user_id: e.actor_user_id,
    actor_display: !e.actor_user_id ? "System" : e.actor_user_id === currentUserId ? "You" : "User",
    event_type: e.event_type,
    title: e.title,
    description: e.description,
    metadata: e.metadata ?? {},
    created_at: e.created_at,
  }));

  return NextResponse.json({ ok: true, events: rows });
}
