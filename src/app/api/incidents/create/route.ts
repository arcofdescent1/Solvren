import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";

type Body = {
  orgId?: string;
  changeEventId?: string | null;
  domain?: "REVENUE" | "DATA" | "WORKFLOW" | "SECURITY";
  severity: number;
  revenueImpact?: number | null;
  detectedAt?: string | null;
  resolvedAt?: string | null;
  description?: string | null;
};

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const severity = Number(body.severity);
  if (!Number.isFinite(severity) || severity < 1 || severity > 5) {
    return NextResponse.json({ error: "severity must be 1..5" }, { status: 400 });
  }

  const changeEventId =
    body.changeEventId && String(body.changeEventId).trim().length > 0
      ? String(body.changeEventId).trim()
      : null;

  let orgId =
    body.orgId && String(body.orgId).trim().length > 0
      ? String(body.orgId).trim()
      : null;

  if (changeEventId) {
    const { data: change, error: ceErr } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, org_id"))
      .eq("id", changeEventId)
      .maybeSingle();

    if (ceErr) return NextResponse.json({ error: ceErr.message }, { status: 500 });
    if (!change) return NextResponse.json({ error: "Change not found" }, { status: 404 });

    orgId = change.org_id;
  }

  if (!orgId) {
    return NextResponse.json(
      { error: "orgId is required when changeEventId is not provided" },
      { status: 400 }
    );
  }

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const domain = (body.domain ?? "REVENUE") as Body["domain"];
  const detectedAt = body.detectedAt ? new Date(body.detectedAt) : new Date();
  if (Number.isNaN(detectedAt.getTime())) {
    return NextResponse.json({ error: "detectedAt must be ISO date" }, { status: 400 });
  }

  const resolvedAt = body.resolvedAt ? new Date(body.resolvedAt) : null;
  if (resolvedAt && Number.isNaN(resolvedAt.getTime())) {
    return NextResponse.json({ error: "resolvedAt must be ISO date" }, { status: 400 });
  }

  const revenueImpact =
    body.revenueImpact === null || body.revenueImpact === undefined
      ? null
      : Number(body.revenueImpact);

  if (revenueImpact !== null && !Number.isFinite(revenueImpact)) {
    return NextResponse.json({ error: "revenueImpact must be a number" }, { status: 400 });
  }

  const description =
    body.description && String(body.description).trim().length > 0
      ? String(body.description).trim()
      : null;

  const hasDesc = Boolean(description && String(description).trim().length);
  const hasImpact = revenueImpact !== null && Number.isFinite(Number(revenueImpact));
  if (Number(severity) < 4 && !hasDesc && !hasImpact) {
    return NextResponse.json(
      {
        error:
          "Add a description or revenue impact (or use severity 4–5) so learning stays high-quality.",
      },
      { status: 400 }
    );
  }

  const { data: inserted, error } = await supabase
    .from("incidents")
    .insert({
      org_id: orgId,
      change_event_id: changeEventId,
      domain,
      severity,
      revenue_impact: revenueImpact,
      detected_at: detectedAt.toISOString(),
      resolved_at: resolvedAt ? resolvedAt.toISOString() : null,
      description,
      created_by: userRes.user.id,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await auditLog(supabase, {
    orgId,
    actorId: userRes.user.id,
    action: "incident_created",
    entityType: "incident",
    entityId: inserted.id,
    metadata: { change_event_id: changeEventId, severity, domain },
  });

  return NextResponse.json({ ok: true, incidentId: inserted.id });
}
