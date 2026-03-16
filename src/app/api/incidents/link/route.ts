import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | { incidentId?: string; changeEventId?: string }
    | null;

  if (!body?.incidentId || !body?.changeEventId) {
    return NextResponse.json({ error: "Missing incidentId or changeEventId" }, { status: 400 });
  }

  const { data: inc, error: iErr } = await supabase
    .from("incidents")
    .select("id, org_id, change_event_id")
    .eq("id", body.incidentId)
    .maybeSingle();

  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });
  if (!inc) return NextResponse.json({ error: "Incident not found" }, { status: 404 });

  const { data: change, error: cErr } = await supabase
    .from("change_events")
    .select("id, org_id")
    .eq("id", body.changeEventId)
    .maybeSingle();

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
  if (!change) return NextResponse.json({ error: "Change not found" }, { status: 404 });

  if (inc.org_id !== change.org_id) {
    return NextResponse.json({ error: "Org mismatch" }, { status: 400 });
  }

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", inc.org_id)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabase
    .from("incidents")
    .update({ change_event_id: body.changeEventId })
    .eq("id", inc.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog(supabase, {
    orgId: inc.org_id,
    actorId: userRes.user.id,
    action: "incident_linked",
    entityType: "incident",
    entityId: inc.id,
    metadata: { change_event_id: body.changeEventId, previous_change_event_id: inc.change_event_id },
  });

  return NextResponse.json({ ok: true });
}
