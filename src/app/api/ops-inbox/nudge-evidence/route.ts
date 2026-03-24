import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Body = { changeEventId: string };

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
  if (!body.changeEventId)
    return NextResponse.json(
      { error: "Missing changeEventId" },
      { status: 400 }
    );

  const { data: change, error: cErr } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, org_id"))
    .eq("id", body.changeEventId)
    .single();

  if (cErr || !change)
    return NextResponse.json(
      { error: cErr?.message ?? "Change not found" },
      { status: 404 }
    );

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", change.org_id)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member)
    return NextResponse.json(
      { error: "Not a member of this organization" },
      { status: 403 }
    );

  const dedupeKey =
    `${change.org_id}:${body.changeEventId}:IN_APP:evidence_missing`;
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from("notification_outbox")
    .select("id")
    .eq("dedupe_key", dedupeKey)
    .gte("created_at", since)
    .limit(1);

  if (existing?.length)
    return NextResponse.json({
      ok: true,
      message: "Nudge already sent recently; deduped.",
    });

  const { error: insErr } = await supabase.from("notification_outbox").insert({
    org_id: change.org_id,
    change_event_id: body.changeEventId,
    channel: "IN_APP",
    template_key: "evidence_missing",
    payload: { changeEventId: body.changeEventId },
    dedupe_key: dedupeKey,
    status: "PENDING",
    attempt_count: 0,
    last_error: null,
    available_at: new Date().toISOString(),
  });

  if (insErr)
    return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
