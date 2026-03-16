import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Body = { changeEventId: string };

function dayKeyUTC() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.changeEventId) {
    return NextResponse.json({ error: "Missing changeEventId" }, { status: 400 });
  }

  // Load change + org (RLS-safe)
  const { data: change, error: cErr } = await supabase
    .from("change_events")
    .select("id, org_id, domain, title, due_at, sla_status, escalated_at")
    .eq("id", body.changeEventId)
    .single();

  if (cErr || !change) {
    return NextResponse.json(
      { error: cErr?.message ?? "Change not found" },
      { status: 404 }
    );
  }

  // Authz: must be org member
  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", change.org_id)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json(
      { error: "Not a member of this organization" },
      { status: 403 }
    );
  }

  // Update only if not already escalated (prevents spam)
  const nowIso = new Date().toISOString();
  const { data: updated, error: updErr } = await supabase
    .from("change_events")
    .update({
      sla_status: "ESCALATED",
      escalated_at: nowIso,
    })
    .eq("id", body.changeEventId)
    .neq("sla_status", "ESCALATED")
    .select("id, org_id, title, due_at")
    .maybeSingle();

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // If it was already escalated, treat as idempotent success
  if (!updated) {
    return NextResponse.json({ ok: true, alreadyEscalated: true });
  }

  // Pull latest risk bucket (optional, but makes Slack/email better)
  const { data: latestAssessment } = await supabase
    .from("impact_assessments")
    .select("risk_bucket")
    .eq("change_event_id", body.changeEventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const risk_bucket = latestAssessment?.risk_bucket ?? null;

  const payload = {
    orgId: String(updated.org_id),
    changeEventId: String(updated.id),
    title: String(updated.title ?? updated.id),
    due_at: updated.due_at ?? null,
    risk_bucket,
    escalated_at: nowIso,
  };

  const domainKey = (change.domain ?? "REVENUE") as string;
  const dedupeBase = `sla_escalated:${updated.org_id}:${domainKey}:${updated.id}`;

  // Enqueue IN_APP always
  await supabase.from("notification_outbox").insert({
    org_id: updated.org_id,
    change_event_id: updated.id,
    channel: "IN_APP",
    template_key: "sla_escalated",
    payload,
    status: "PENDING",
    available_at: nowIso,
    dedupe_key: `${dedupeBase}:in_app`,
  });

  // Enqueue SLACK + EMAIL too.
  // Your outbox processor will:
  // - gate Slack by plan + org settings
  // - gate email by plan + org settings
  await supabase.from("notification_outbox").insert([
    {
      org_id: updated.org_id,
      change_event_id: updated.id,
      channel: "SLACK",
      template_key: "sla_escalated",
      payload,
      status: "PENDING",
      available_at: nowIso,
      dedupe_key: `${dedupeBase}:slack`,
    },
    {
      org_id: updated.org_id,
      change_event_id: updated.id,
      channel: "EMAIL",
      template_key: "sla_escalated",
      payload,
      status: "PENDING",
      available_at: nowIso,
      dedupe_key: `${dedupeBase}:email`,
    },
  ]);

  return NextResponse.json({ ok: true });
}
