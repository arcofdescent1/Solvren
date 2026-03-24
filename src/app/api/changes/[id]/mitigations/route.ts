import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchMitigationsForSignals } from "@/services/risk/mitigationsDb";
import { auditLog } from "@/lib/audit";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: changeId } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: change, error } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, org_id, domain"))
    .eq("id", changeId)
    .maybeSingle();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!change)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  const { data: signals } = await supabase
    .from("risk_signals")
    .select("signal_key")
    .eq("change_event_id", changeId);

  const signalKeys = Array.from(
    new Set((signals ?? []).map((s) => s.signal_key).filter(Boolean))
  ) as string[];

  const mitigations = await fetchMitigationsForSignals(supabase, {
    orgId: String(change.org_id),
    domain: (change.domain ?? "REVENUE") as string,
    signalKeys,
  });

  return NextResponse.json({ mitigations });
}

type MitigationActionBody = {
  signalKey?: string | null;
  mitigationId?: string | null;
  mitigationKey?: string | null;
  recommendation?: string | null;
  action: "APPLY" | "DISMISS";
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: changeId } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: MitigationActionBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data: change, error: cErr } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, org_id, domain"))
    .eq("id", changeId)
    .maybeSingle();

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
  if (!change)
    return NextResponse.json({ error: "Change not found" }, { status: 404 });

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

  const now = new Date().toISOString();
  const status = body.action === "APPLY" ? "APPLIED" : "DISMISSED";

  const { error: insErr } = await supabase
    .from("change_mitigation_actions")
    .insert({
      org_id: change.org_id,
      change_event_id: changeId,
      domain: (change.domain ?? "REVENUE") as string,
      signal_key: body.signalKey ?? null,
      mitigation_id: body.mitigationId ?? null,
      mitigation_key: body.mitigationKey ?? null,
      recommendation: body.recommendation ?? null,
      status,
      applied_at: status === "APPLIED" ? now : null,
      dismissed_at: status === "DISMISSED" ? now : null,
    });

  if (insErr)
    return NextResponse.json({ error: insErr.message }, { status: 500 });

  if (status === "APPLIED") {
    await auditLog(supabase, {
      orgId: String(change.org_id),
      changeEventId: changeId,
      actorId: userRes.user.id,
      action: "mitigation_applied",
      entityType: "mitigation_action",
      metadata: {
        signalKey: body.signalKey ?? null,
        mitigationKey: body.mitigationKey ?? null,
        mitigationId: body.mitigationId ?? null,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
