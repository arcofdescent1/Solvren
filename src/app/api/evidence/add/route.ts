import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { addTimelineEvent } from "@/services/timeline/addTimelineEvent";
import { canRole } from "@/lib/rbac/permissions";
import { parseOrgRole } from "@/lib/rbac/roles";
import { canViewChange } from "@/lib/access/changeAccess";

type Body = {
  changeEventId: string;
  kind: string;
  label: string;
  url?: string | null;
  note?: string | null;
};

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.changeEventId || !body.kind || !body.label) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { data: change, error: ceErr } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, org_id, domain, status, created_by, is_restricted"))
    .eq("id", body.changeEventId)
    .single();

  if (ceErr || !change)
    return NextResponse.json(
      { error: ceErr?.message ?? "Change not found" },
      { status: 404 }
    );

  const canView = await canViewChange(supabase, userRes.user.id, change);
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", change.org_id)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member)
    return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 });
  if (!canRole(parseOrgRole((member as { role?: string | null }).role ?? null), "change.evidence.provide")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("change_evidence").insert({
    change_event_id: body.changeEventId,
    org_id: change.org_id,
    kind: body.kind,
    label: body.label,
    url: body.url ?? null,
    note: body.note ?? null,
    created_by: userRes.user.id,
  });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  await addTimelineEvent({
    supabase,
    orgId: change.org_id,
    changeEventId: body.changeEventId,
    actorUserId: userRes.user.id,
    eventType: "EVIDENCE_PROVIDED",
    title: "Evidence added",
    description: `${body.label || body.kind} provided`,
    metadata: { evidence_kind: body.kind, label: body.label, url: body.url ?? null },
  });

  return NextResponse.json({ ok: true });
}
