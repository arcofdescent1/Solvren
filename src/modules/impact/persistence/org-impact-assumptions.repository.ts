/**
 * Phase 5 — org_impact_assumptions repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type OrgAssumptionRow = {
  id: string;
  org_id: string;
  assumption_key: string;
  display_name: string;
  value_json: Record<string, unknown>;
  value_type: string;
  source: string;
  effective_from: string;
  effective_to: string | null;
  confidence_score: number | null;
  notes: string | null;
  updated_by_user_id?: string | null;
  created_at: string;
};

export async function getEffectiveAssumptions(
  supabase: SupabaseClient,
  orgId: string,
  keys?: string[]
): Promise<Record<string, number | string | boolean>> {
  const now = new Date().toISOString();
  let q = supabase
    .from("org_impact_assumptions")
    .select("assumption_key, value_json, value_type")
    .eq("org_id", orgId)
    .lte("effective_from", now)
    .or(`effective_to.is.null,effective_to.gte.${now}`);
  if (keys?.length) q = q.in("assumption_key", keys);

  const { data } = await q;
  const out: Record<string, number | string | boolean> = {};
  for (const row of data ?? []) {
    const r = row as { assumption_key: string; value_json: unknown; value_type: string };
    const v = r.value_json;
    if (typeof v === "number") out[r.assumption_key] = v;
    else if (typeof v === "string") out[r.assumption_key] = v;
    else if (typeof v === "boolean") out[r.assumption_key] = v;
    else if (v != null && typeof v === "object" && "value" in (v as object)) out[r.assumption_key] = (v as { value: number | string | boolean }).value;
    else if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      const n = (v as Record<string, unknown>).value ?? (v as Record<string, unknown>).number;
      if (typeof n === "number") out[r.assumption_key] = n;
    }
  }
  return out;
}

const DEFAULT_VALUES: Record<string, number> = {
  avg_deal_size: 25000,
  mql_to_opportunity_rate: 0.15,
  opportunity_to_close_rate: 0.25,
  meeting_to_opportunity_rate: 0.35,
  lead_response_decay_factor: 0.1,
  payment_recovery_rate: 0.6,
  avg_subscription_mrr: 500,
  avg_ltv_multiplier: 24,
  loaded_labor_cost_per_hour: 75,
  duplicate_cleanup_minutes_per_record: 15,
  critical_surface_revenue_share: 0.2,
};

export type EffectiveAssumptionWithMeta = {
  key: string;
  value: number | string | boolean;
  valueType: string;
  source: string;
  effectiveFrom: string | null;
  displayName: string;
};

export async function getEffectiveAssumptionsWithMetadata(
  supabase: SupabaseClient,
  orgId: string
): Promise<EffectiveAssumptionWithMeta[]> {
  const now = new Date().toISOString();
  const { data: rows } = await supabase
    .from("org_impact_assumptions")
    .select("assumption_key, value_json, value_type, source, effective_from, display_name")
    .eq("org_id", orgId)
    .lte("effective_from", now)
    .or(`effective_to.is.null,effective_to.gte.${now}`)
    .order("effective_from", { ascending: false });

  const byKey = new Map<string, EffectiveAssumptionWithMeta>();
  for (const r of rows ?? []) {
    const row = r as { assumption_key: string; value_json: unknown; value_type: string; source: string; effective_from: string; display_name: string };
    if (byKey.has(row.assumption_key)) continue;
    const v = row.value_json;
    let value: number | string | boolean;
    if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") value = v;
    else if (v != null && typeof v === "object" && "value" in (v as object)) value = (v as { value: number | string | boolean }).value;
    else {
      const raw = (v as Record<string, unknown>)?.value ?? (v as Record<string, unknown>)?.number ?? DEFAULT_VALUES[row.assumption_key] ?? 0;
      value = typeof raw === "number" || typeof raw === "string" || typeof raw === "boolean" ? raw : 0;
    }
    byKey.set(row.assumption_key, {
      key: row.assumption_key,
      value,
      valueType: row.value_type,
      source: row.source,
      effectiveFrom: row.effective_from,
      displayName: row.display_name,
    });
  }
  for (const key of Object.keys(DEFAULT_VALUES)) {
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        value: DEFAULT_VALUES[key],
        valueType: "number",
        source: "default",
        effectiveFrom: null,
        displayName: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      });
    }
  }
  return Array.from(byKey.values());
}

export async function upsertOrgAssumption(
  supabase: SupabaseClient,
  input: {
    org_id: string;
    assumption_key: string;
    display_name: string;
    value_json: Record<string, unknown>;
    value_type: string;
    source: string;
    updated_by_user_id?: string | null;
    notes?: string | null;
  }
): Promise<{ error: Error | null }> {
  const now = new Date().toISOString();
  const { data: current } = await supabase
    .from("org_impact_assumptions")
    .select("id")
    .eq("org_id", input.org_id)
    .eq("assumption_key", input.assumption_key)
    .is("effective_to", null)
    .maybeSingle();
  if (current) {
    await supabase
      .from("org_impact_assumptions")
      .update({ effective_to: now })
      .eq("id", (current as { id: string }).id);
  }
  const { error } = await supabase.from("org_impact_assumptions").insert({
    ...input,
    effective_from: now,
    notes: input.notes ?? null,
  });
  return { error: error as Error | null };
}

export async function listAssumptionHistory(
  supabase: SupabaseClient,
  orgId: string,
  assumptionKey: string,
  limit = 20
): Promise<{ data: OrgAssumptionRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("org_impact_assumptions")
    .select("*")
    .eq("org_id", orgId)
    .eq("assumption_key", assumptionKey)
    .order("effective_from", { ascending: false })
    .limit(limit);
  return { data: (data ?? []) as OrgAssumptionRow[], error: error as Error | null };
}
