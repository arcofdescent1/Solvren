import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";

type Body = {
  incidentId: string;
  severity?: number;
  revenueImpact?: number | null;
  detectedAt?: string;
  resolvedAt?: string | null;
  description?: string | null;
};

export async function PATCH(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Body | null;
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

  const patch: Record<string, unknown> = {};
  if (body.severity != null) patch.severity = body.severity;
  if (body.revenueImpact !== undefined) patch.revenue_impact = body.revenueImpact;
  if (body.detectedAt) patch.detected_at = body.detectedAt;
  if (body.resolvedAt !== undefined) patch.resolved_at = body.resolvedAt;
  if (body.description !== undefined) patch.description = body.description;

  const { error } = await supabase.from("incidents").update(patch).eq("id", body.incidentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog(supabase, {
    orgId: inc.org_id,
    actorId: userRes.user.id,
    action: "incident_updated",
    entityType: "incident",
    entityId: body.incidentId,
    metadata: { patch },
  });

  return NextResponse.json({ ok: true });
}
