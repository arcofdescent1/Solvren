/**
 * Value Engine → public.issues (Phase 2/3 single source of truth).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertDetectionIssue } from "@/lib/issues/persistDetectionIssue";

export type ValueEngineIssueInsert = {
  org_id: string;
  source: string;
  type: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  revenue_impact_cents: number;
  currency?: string;
  affected_count: number;
  status?: "detected" | "acknowledged" | "dismissed";
  confidence: "high" | "medium" | "low";
  recommended_action?: string;
  issue_key: string;
  metadata: Record<string, unknown>;
  /** HubSpot/Salesforce: true when avg deal was missing and fallback was used. Stripe: false. */
  revenue_impact_fallback?: boolean;
};

export async function upsertValueEngineIssue(
  supabase: SupabaseClient,
  row: ValueEngineIssueInsert
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await upsertDetectionIssue(supabase, {
    orgId: row.org_id,
    issueKey: row.issue_key,
    source: row.source,
    type: row.type,
    title: row.title,
    description: row.description,
    severity: row.severity,
    revenueImpactCents: row.revenue_impact_cents,
    currency: row.currency,
    affectedCount: row.affected_count,
    confidence: row.confidence,
    metadata: row.metadata,
    revenueImpactFallback: row.revenue_impact_fallback === true,
  });

  if (!r.ok) return r;
  return { ok: true };
}
