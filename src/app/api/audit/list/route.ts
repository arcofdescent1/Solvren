import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const changeId = url.searchParams.get("changeId");
  if (!changeId)
    return NextResponse.json({ error: "Missing changeId" }, { status: 400 });

  const { data: change, error: ceErr } = await supabase
    .from("change_events")
    .select("id, org_id")
    .eq("id", changeId)
    .single();

  if (ceErr || !change)
    return NextResponse.json(
      { error: ceErr?.message ?? "Not found" },
      { status: 404 }
    );

  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("org_id", change.org_id)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (!member)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: rows, error } = await supabase
    .from("audit_log")
    .select(
      "id, change_event_id, actor_id, actor_type, action, entity_type, entity_id, metadata, created_at"
    )
    .eq("org_id", change.org_id)
    .or(`change_event_id.eq.${changeId},and(entity_type.eq.change,entity_id.eq.${changeId})`)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, rows: rows ?? [] });
}
