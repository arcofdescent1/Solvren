import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { canGrantRestrictedAccess, canViewChange } from "@/lib/access/changeAccess";
import { markRevenueImpactStale } from "@/services/revenueImpact/markRevenueImpactStale";
import { markCoordinationPlanStale } from "@/services/coordination/markCoordinationPlanStale";

const REVENUE_SURFACES = [
  "PRICING", "BILLING", "PAYMENTS", "SUBSCRIPTIONS",
  "ENTITLEMENTS", "CHECKOUT", "TAX", "PROMOTIONS",
  "INVOICING", "OTHER",
] as const;

type Body = {
  estimatedMrrAffected?: number | null;
  percentCustomerBaseAffected?: number | null;
  revenueSurface?: string | null;
  title?: string;
  isRestricted?: boolean;
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  const { data: change, error: ceErr } = await supabase
    .from("change_events")
    .select("id, org_id, domain, status, created_by, is_restricted")
    .eq("id", id)
    .single();

  if (ceErr || !change) {
    return NextResponse.json(
      { error: ceErr?.message ?? "Change not found" },
      { status: 404 }
    );
  }

  const canView = await canViewChange(supabase, userRes.user.id, change);
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const estimatedMrrAffected =
    body.estimatedMrrAffected == null ? undefined : Number(body.estimatedMrrAffected);
  const percentCustomerBaseAffected =
    body.percentCustomerBaseAffected == null
      ? undefined
      : Number(body.percentCustomerBaseAffected);
  const revenueSurface = body.revenueSurface ?? undefined;

  // Guardrails
  if (percentCustomerBaseAffected != null) {
    if (percentCustomerBaseAffected < 0 || percentCustomerBaseAffected > 100) {
      return NextResponse.json(
        { error: "percentCustomerBaseAffected must be 0–100" },
        { status: 400 }
      );
    }
  }
  if (estimatedMrrAffected != null && estimatedMrrAffected < 0) {
    return NextResponse.json(
      { error: "estimatedMrrAffected must be non-negative" },
      { status: 400 }
    );
  }
  if (
    revenueSurface != null &&
    revenueSurface !== "" &&
    !REVENUE_SURFACES.includes(revenueSurface as (typeof REVENUE_SURFACES)[number])
  ) {
    return NextResponse.json(
      { error: "Invalid revenueSurface" },
      { status: 400 }
    );
  }

  const patch: Record<string, unknown> = {};
  if (body.title !== undefined) patch.title = body.title;
  if (estimatedMrrAffected !== undefined)
    patch.estimated_mrr_affected = estimatedMrrAffected;
  if (percentCustomerBaseAffected !== undefined)
    patch.percent_customer_base_affected = percentCustomerBaseAffected;
  if (revenueSurface !== undefined)
    patch.revenue_surface = revenueSurface === "" ? null : revenueSurface;
  if (body.isRestricted !== undefined) {
    const canManageRestricted = await canGrantRestrictedAccess(supabase, userRes.user.id, change);
    if (!canManageRestricted) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    patch.is_restricted = Boolean(body.isRestricted);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error: updErr } = await supabase
    .from("change_events")
    .update(patch)
    .eq("id", id);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  await auditLog(supabase, {
    orgId: String(change.org_id),
    actorId: userRes.user.id,
    actorType: "USER",
    action: "change_updated",
    entityType: "change",
    entityId: id,
    metadata: patch,
  });

  const materialFields = new Set([
    "title",
    "estimated_mrr_affected",
    "percent_customer_base_affected",
    "revenue_surface",
  ]);
  if (Object.keys(patch).some((k) => materialFields.has(k))) {
    await markRevenueImpactStale({
      supabase,
      orgId: String(change.org_id),
      changeId: id,
      actorUserId: userRes.user.id,
      reason: "Material change fields updated",
    });
    await markCoordinationPlanStale({
      supabase,
      orgId: String(change.org_id),
      changeId: id,
      actorUserId: userRes.user.id,
      reason: "Material change fields updated",
    });
  }

  return NextResponse.json({ ok: true });
}
