/**
 * Phase 5 — PUT /api/admin/impact/assumptions/:assumptionKey (§18.2).
 */
import { NextResponse } from "next/server";
import { upsertOrgAssumption } from "@/modules/impact/persistence/org-impact-assumptions.repository";
import { queueRecalculationAfterAssumptionChange } from "@/modules/impact/jobs/recalculate-after-assumption-change.job";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_ASSUMPTION_KEYS } from "@/modules/impact/domain/assumption-set";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

const DISPLAY_NAMES: Record<string, string> = {
  avg_deal_size: "Average deal size",
  mql_to_opportunity_rate: "MQL to opportunity rate",
  opportunity_to_close_rate: "Opportunity to close rate",
  meeting_to_opportunity_rate: "Meeting to opportunity rate",
  lead_response_decay_factor: "Lead response decay factor",
  payment_recovery_rate: "Payment recovery rate",
  avg_subscription_mrr: "Average subscription MRR",
  avg_ltv_multiplier: "Average LTV multiplier",
  loaded_labor_cost_per_hour: "Loaded labor cost per hour",
  duplicate_cleanup_minutes_per_record: "Duplicate cleanup minutes per record",
  critical_surface_revenue_share: "Critical surface revenue share",
};

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ assumptionKey: string }> }
) {
  try {
    const ctx = await requireAnyOrgPermission("domains.manage");

    const { assumptionKey } = await params;
    if (!DEFAULT_ASSUMPTION_KEYS.includes(assumptionKey as (typeof DEFAULT_ASSUMPTION_KEYS)[number])) {
      return NextResponse.json({ error: "Invalid assumption key" }, { status: 400 });
    }

    let body: { value: number | string | boolean; notes?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const value = body.value;
    const valueType = typeof value;
    if (valueType !== "number" && valueType !== "string" && valueType !== "boolean") {
      return NextResponse.json({ error: "Value must be number, string, or boolean" }, { status: 400 });
    }

    const valueJson = typeof value === "number" ? { value } : typeof value === "string" ? { value } : { value };
    const displayName = DISPLAY_NAMES[assumptionKey] ?? assumptionKey;

    const { error } = await upsertOrgAssumption(ctx.supabase, {
      org_id: ctx.orgId,
      assumption_key: assumptionKey,
      display_name: displayName,
      value_json: valueJson,
      value_type: valueType,
      source: "org_override",
      updated_by_user_id: ctx.user.id,
      notes: body.notes ?? null,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await queueRecalculationAfterAssumptionChange(
      createAdminClient(),
      ctx.orgId,
      ctx.user.id
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
