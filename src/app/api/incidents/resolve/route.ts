import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    incidentId?: string;
    resolution?: string | null;
    realizedMrrImpact?: number | null;
    realizedRevenueImpact?: number | null;
    occurredAt?: string | null;
    impactNotes?: string | null;
  } | null;
  if (!body?.incidentId) return NextResponse.json({ error: "Missing incidentId" }, { status: 400 });

  const { data: inc, error: iErr } = await supabase
    .from("incidents")
    .select("id, org_id")
    .eq("id", body.incidentId)
    .maybeSingle();

  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });
  if (!inc) return NextResponse.json({ error: "Incident not found" }, { status: 404 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", inc.org_id)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("incidents")
    .update({
      resolved_at: now,
      realized_mrr_impact: body.realizedMrrImpact ?? null,
      realized_revenue_impact: body.realizedRevenueImpact ?? null,
      occurred_at: body.occurredAt ?? null,
      impact_notes: body.impactNotes ?? null,
    })
    .eq("id", inc.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog(supabase, {
    orgId: inc.org_id,
    actorId: userRes.user.id,
    action: "incident_resolved",
    entityType: "incident",
    entityId: inc.id,
    metadata: {
      resolved_at: now,
      realizedMrrImpact: body.realizedMrrImpact,
      realizedRevenueImpact: body.realizedRevenueImpact,
      occurredAt: body.occurredAt,
    },
  });

  return NextResponse.json({ ok: true });
}
