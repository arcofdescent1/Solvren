/**
 * Experience 3 — Full System Timeline API
 * GET /api/risk/event/{id}/timeline
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: event, error } = await supabase
    .from("risk_events")
    .select("id, org_id, provider, object, timestamp, field, old_value, new_value, impact_amount, approved_at, change_event_id")
    .eq("id", id)
    .single();

  if (error || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("org_id", (event as { org_id: string }).org_id)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const timeline: Array<{
    timestamp: string;
    provider: string;
    object: string;
    description: string;
    field?: string;
    oldValue?: unknown;
    newValue?: unknown;
    impactAmount?: number;
  }> = [];

  const { data: links } = await supabase
    .from("risk_event_links")
    .select("source_event_id, target_event_id")
    .or(`source_event_id.eq.${id},target_event_id.eq.${id}`);

  const linkedIds = new Set<string>();
  for (const l of links ?? []) {
    const s = (l as { source_event_id: string }).source_event_id;
    const t = (l as { target_event_id: string }).target_event_id;
    if (s !== id) linkedIds.add(s);
    if (t !== id) linkedIds.add(t);
  }

  const ev = event as {
    provider: string;
    object: string;
    timestamp: string;
    field?: string;
    old_value?: unknown;
    new_value?: unknown;
    impact_amount?: number;
    approved_at?: string | null;
  };
  const desc = ev.field
    ? `${ev.provider} ${ev.object} updated — ${ev.field}`
    : `${ev.provider} ${ev.object} updated`;
  timeline.push({
    timestamp: ev.timestamp,
    provider: ev.provider,
    object: ev.object,
    description: desc,
    field: ev.field,
    oldValue: ev.old_value,
    newValue: ev.new_value,
    impactAmount: ev.impact_amount ?? undefined,
  });

  if (linkedIds.size > 0) {
    const { data: linked } = await supabase
      .from("risk_events")
      .select("id, provider, object, timestamp, field, old_value, new_value, impact_amount")
      .in("id", [...linkedIds])
      .order("timestamp", { ascending: true });
    for (const le of linked ?? []) {
      const l = le as {
        provider: string;
        object: string;
        timestamp: string;
        field?: string;
        old_value?: unknown;
        new_value?: unknown;
        impact_amount?: number;
      };
      const ld = l.field
        ? `${l.provider} ${l.object} updated — ${l.field}`
        : `${l.provider} ${l.object} updated`;
      timeline.push({
        timestamp: l.timestamp,
        provider: l.provider,
        object: l.object,
        description: ld,
        field: l.field,
        oldValue: l.old_value,
        newValue: l.new_value,
        impactAmount: l.impact_amount ?? undefined,
      });
    }
  }

  if (ev.approved_at) {
    timeline.push({
      timestamp: ev.approved_at,
      provider: "solvren",
      object: "approval",
      description: "Solvren detected risk",
    });
  }

  timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return NextResponse.json({ ok: true, timeline });
}
