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

  const { data: events, error } = await supabase
    .from("sla_events")
    .select(
      "id, previous_state, new_state, triggered_by, triggered_source, created_at"
    )
    .eq("change_event_id", changeId)
    .order("created_at", { ascending: true });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, events: events ?? [] });
}
