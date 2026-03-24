import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { recomputeAndPersistRevenueFields } from "@/services/risk/revenuePersist";

type Body = {
  estimatedMrrAffected?: number | null;
  percentCustomerBaseAffected?: number | null;
  revenueSurface?: string | null;
};

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: changeId } = await ctx.params;
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

  const { data: change, error: changeErr } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, org_id"))
    .eq("id", changeId)
    .maybeSingle();

  if (changeErr)
    return NextResponse.json({ error: changeErr.message }, { status: 500 });
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

  const estimated =
    body.estimatedMrrAffected == null ? null : Number(body.estimatedMrrAffected);
  const pct =
    body.percentCustomerBaseAffected == null
      ? null
      : Number(body.percentCustomerBaseAffected);
  const surface = body.revenueSurface ?? null;

  if (pct != null && (pct < 0 || pct > 100)) {
    return NextResponse.json(
      { error: "percentCustomerBaseAffected must be 0..100" },
      { status: 400 }
    );
  }
  if (estimated != null && estimated < 0) {
    return NextResponse.json(
      { error: "estimatedMrrAffected must be >= 0" },
      { status: 400 }
    );
  }

  const { error: updErr } = await supabase
    .from("change_events")
    .update({
      estimated_mrr_affected: estimated,
      percent_customer_base_affected: pct,
      revenue_surface: surface,
    })
    .eq("id", changeId);

  if (updErr)
    return NextResponse.json({ error: updErr.message }, { status: 500 });

  const computed = await recomputeAndPersistRevenueFields(supabase, {
    changeId,
  });

  return NextResponse.json({
    changeId,
    revenue: {
      exposureMultiplier: computed.exposureMultiplier,
      normalizedExposure: computed.normalizedExposure,
      explanation: computed.explanation,
      revenueAtRisk: computed.revenueAtRisk,
      estimatedMrrAffected: estimated,
      percentCustomerBaseAffected: pct,
      revenueSurface: surface,
    },
  });
}
