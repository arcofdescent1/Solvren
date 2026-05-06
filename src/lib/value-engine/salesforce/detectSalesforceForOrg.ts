/**
 * Phase 1 — Salesforce detections from raw_events.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildIssueKey } from "../issueKey";
import { upsertValueEngineIssue } from "../issuesRepo";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const FALLBACK_AVG_DEAL_CENTS = 500_000;

const CLOSED = new Set(["Closed Won", "Closed Lost"]);

type RawEv = { event_type: string; occurred_at: string; payload_json: Record<string, unknown> };

export async function detectSalesforceForOrg(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: rows, error } = await supabase
    .from("raw_events")
    .select("event_type, occurred_at, payload_json")
    .eq("org_id", orgId)
    .eq("provider", "salesforce");

  if (error) return { ok: false, error: error.message };
  const evs = (rows ?? []) as RawEv[];
  const opps = evs.filter((e) => e.event_type === "sf_opportunity");

  const now = Date.now();
  const amounts: number[] = [];
  for (const e of opps) {
    const amt = Number(e.payload_json.Amount ?? NaN);
    if (Number.isFinite(amt) && amt > 0) amounts.push(Math.round(amt * 100));
  }
  const avg =
    amounts.length > 0 ? Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length) : FALLBACK_AVG_DEAL_CENTS;
  const revenueImpactFallback = amounts.length === 0;

  let stale = 0;
  const staleSamples: { id: string; label: string }[] = [];
  for (const e of opps) {
    const p = e.payload_json;
    const stage = String(p.StageName ?? "");
    if (CLOSED.has(stage)) continue;
    const lm = new Date(String(p.LastModifiedDate ?? "")).getTime();
    if (!Number.isFinite(lm) || now - lm < FOURTEEN_DAYS_MS) continue;
    stale += 1;
    if (staleSamples.length < 10) {
      staleSamples.push({ id: String(p.Id), label: `Opportunity ${String(p.Id).slice(0, 8)}…` });
    }
  }
  if (stale > 0) {
    await upsertValueEngineIssue(supabase, {
      org_id: orgId,
      revenue_impact_fallback: revenueImpactFallback,
      source: "salesforce",
      type: "salesforce_stale_opportunities",
      title: "Stale open opportunities",
      description: `${stale} open opportunity(ies) have not been modified in 14+ days (excluding Closed Won/Lost).`,
      severity: "medium",
      revenue_impact_cents: Math.round(stale * avg * 0.3),
      affected_count: stale,
      confidence: "medium",
      issue_key: buildIssueKey(orgId, "salesforce", "salesforce_stale_opportunities"),
      metadata: {
        sampleRecords: staleSamples,
        avgDealValue: avg / 100,
        conversionRate: 0.15,
      },
    });
  }

  let missingOwner = 0;
  const moSamples: { id: string; label: string }[] = [];
  for (const e of opps) {
    const p = e.payload_json;
    const oid = p.OwnerId;
    if (oid != null && String(oid).trim() !== "") continue;
    missingOwner += 1;
    if (moSamples.length < 10) {
      moSamples.push({ id: String(p.Id), label: `Opportunity ${String(p.Id).slice(0, 8)}…` });
    }
  }
  if (missingOwner > 0) {
    await upsertValueEngineIssue(supabase, {
      org_id: orgId,
      revenue_impact_fallback: revenueImpactFallback,
      source: "salesforce",
      type: "salesforce_missing_owner",
      title: "Opportunities missing owner",
      description: `${missingOwner} opportunity(ies) have no OwnerId.`,
      severity: "medium",
      revenue_impact_cents: Math.round(missingOwner * avg * 0.1),
      affected_count: missingOwner,
      confidence: "medium",
      issue_key: buildIssueKey(orgId, "salesforce", "salesforce_missing_owner"),
      metadata: { sampleRecords: moSamples },
    });
  }

  return { ok: true };
}
