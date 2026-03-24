import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const changeEventId = url.searchParams.get("changeEventId");
  if (!changeEventId) return NextResponse.json({ error: "Missing changeEventId" }, { status: 400 });

  const { data: change, error: ceErr } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, org_id"))
    .eq("id", changeEventId)
    .maybeSingle();

  if (ceErr) return NextResponse.json({ error: ceErr.message }, { status: 500 });
  if (!change) return NextResponse.json({ error: "Change not found" }, { status: 404 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", change.org_id)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: incidents, error } = await supabase
    .from("incidents")
    .select("id, severity, revenue_impact, detected_at, resolved_at, description")
    .eq("change_event_id", changeEventId)
    .order("detected_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, incidents: incidents ?? [] });
}
