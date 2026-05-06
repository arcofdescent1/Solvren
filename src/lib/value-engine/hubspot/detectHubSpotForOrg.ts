/**
 * Phase 1 — HubSpot detections from raw_events.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildIssueKey } from "../issueKey";
import { upsertValueEngineIssue } from "../issuesRepo";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const FALLBACK_AVG_DEAL_CENTS = 500_000; // $5,000

const LEAD_STAGES = new Set(["lead", "marketingqualifiedlead"]);

type RawEv = { event_type: string; occurred_at: string; payload_json: Record<string, unknown> };

function parseTs(s: unknown): number | null {
  if (s == null || s === "") return null;
  const t = new Date(String(s)).getTime();
  return Number.isFinite(t) ? t : null;
}

export async function detectHubSpotForOrg(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: rows, error } = await supabase
    .from("raw_events")
    .select("event_type, occurred_at, payload_json")
    .eq("org_id", orgId)
    .eq("provider", "hubspot");

  if (error) return { ok: false, error: error.message };
  const evs = (rows ?? []) as RawEv[];

  const contacts = evs.filter((e) => e.event_type === "hubspot_contact");
  const deals = evs.filter((e) => e.event_type === "hubspot_deal");

  const now = Date.now();

  const amounts: number[] = [];
  for (const e of deals) {
    const amt = Number(e.payload_json.amount ?? NaN);
    if (Number.isFinite(amt) && amt > 0) amounts.push(amt * 100); // HubSpot deal amount usually major units
  }
  const avgDealCents =
    amounts.length > 0 ? Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length) : FALLBACK_AVG_DEAL_CENTS;
  const avgDealValueUsd = avgDealCents / 100;
  const revenueImpactFallback = amounts.length === 0;

  // 1) Duplicate contacts — same email hash count > 1
  const byHash = new Map<string, string[]>();
  for (const e of contacts) {
    const h = e.payload_json.email_norm_hash as string | undefined;
    const id = String(e.payload_json.id ?? "");
    if (!h) continue;
    const arr = byHash.get(h) ?? [];
    arr.push(id);
    byHash.set(h, arr);
  }
  let dupGroups = 0;
  const dupSamples: { id: string; label: string }[] = [];
  for (const [, ids] of byHash) {
    if (ids.length <= 1) continue;
    dupGroups += 1;
    if (dupSamples.length < 10) {
      dupSamples.push({
        id: ids[0] ?? "",
        label: `${ids.length} contacts share the same email fingerprint`,
      });
    }
  }
  if (dupGroups > 0) {
    await upsertValueEngineIssue(supabase, {
      org_id: orgId,
      revenue_impact_fallback: revenueImpactFallback,
      source: "hubspot",
      type: "hubspot_duplicate_contacts",
      title: "Duplicate HubSpot contacts detected",
      description: `${dupGroups} duplicate email group(s) found (normalized email hash).`,
      severity: "medium",
      revenue_impact_cents: dupGroups * Math.round(avgDealCents * 0.05),
      affected_count: dupGroups,
      confidence: "medium",
      issue_key: buildIssueKey(orgId, "hubspot", "hubspot_duplicate_contacts"),
      metadata: {
        sampleRecords: dupSamples,
        avgDealCentsUsed: avgDealCents,
        avgDealValue: avgDealValueUsd,
        conversionRate: 0.2,
      },
    });
  }

  // 2) No follow-up leads (3 days) — proxy: sales activity / notes timestamps
  let noFollow = 0;
  const nfSamples: { id: string; label: string }[] = [];
  for (const e of contacts) {
    const p = e.payload_json;
    const stage = String(p.lifecyclestage ?? "").toLowerCase();
    if (!LEAD_STAGES.has(stage)) continue;
    const act = Math.max(
      parseTs(p.hs_last_sales_activity_timestamp) ?? 0,
      parseTs(p.notes_last_contacted) ?? 0
    );
    const activeOk = act > 0 && now - act < THREE_DAYS_MS;
    if (activeOk) continue;
    noFollow += 1;
    if (nfSamples.length < 10) {
      nfSamples.push({ id: String(p.id), label: `Contact ${String(p.id).slice(0, 8)}… (${stage})` });
    }
  }
  if (noFollow > 0) {
    const impact = Math.round(noFollow * avgDealCents * 0.2);
    await upsertValueEngineIssue(supabase, {
      org_id: orgId,
      revenue_impact_fallback: revenueImpactFallback,
      source: "hubspot",
      type: "hubspot_no_followup_leads",
      title: "Leads without recent follow-up",
      description: `${noFollow} lead/MQL contacts have no recorded sales activity or notes in the last 3 days.`,
      severity: "medium",
      revenue_impact_cents: impact,
      affected_count: noFollow,
      confidence: "medium",
      issue_key: buildIssueKey(orgId, "hubspot", "hubspot_no_followup_leads"),
      metadata: {
        sampleRecords: nfSamples,
        avgDealValue: avgDealValueUsd,
        conversionRate: 0.2,
      },
    });
  }

  // 3) Missing lifecycle
  let missingLc = 0;
  const mlSamples: { id: string; label: string }[] = [];
  for (const e of contacts) {
    const p = e.payload_json;
    const lc = String(p.lifecyclestage ?? "").trim();
    if (lc !== "") continue;
    missingLc += 1;
    if (mlSamples.length < 10) mlSamples.push({ id: String(p.id), label: `Contact ${String(p.id).slice(0, 8)}…` });
  }
  if (missingLc > 0) {
    await upsertValueEngineIssue(supabase, {
      org_id: orgId,
      revenue_impact_fallback: revenueImpactFallback,
      source: "hubspot",
      type: "hubspot_missing_lifecycle",
      title: "Contacts missing lifecycle stage",
      description: `${missingLc} contact(s) have no lifecycle stage set.`,
      severity: "low",
      revenue_impact_cents: Math.round(missingLc * avgDealCents * 0.05),
      affected_count: missingLc,
      confidence: "medium",
      issue_key: buildIssueKey(orgId, "hubspot", "hubspot_missing_lifecycle"),
      metadata: { sampleRecords: mlSamples },
    });
  }

  // 4) Stalled deals (14d, not closed)
  let stalled = 0;
  const stSamples: { id: string; label: string }[] = [];
  for (const e of deals) {
    const p = e.payload_json;
    const closed = String(p.hs_is_closed ?? "").toLowerCase() === "true";
    if (closed) continue;
    const mod = parseTs(p.hs_lastmodifieddate);
    if (mod == null || now - mod < FOURTEEN_DAYS_MS) continue;
    stalled += 1;
    if (stSamples.length < 10) {
      stSamples.push({ id: String(p.id), label: String(p.dealname ?? `Deal ${String(p.id).slice(0, 6)}`) });
    }
  }
  if (stalled > 0) {
    await upsertValueEngineIssue(supabase, {
      org_id: orgId,
      revenue_impact_fallback: revenueImpactFallback,
      source: "hubspot",
      type: "hubspot_stalled_deals",
      title: "Open deals stalled 14+ days",
      description: `${stalled} open deal(s) have not moved in over 14 days.`,
      severity: "medium",
      revenue_impact_cents: Math.round(stalled * avgDealCents * 0.15),
      affected_count: stalled,
      confidence: "medium",
      issue_key: buildIssueKey(orgId, "hubspot", "hubspot_stalled_deals"),
      metadata: {
        sampleRecords: stSamples,
        avgDealValue: avgDealValueUsd,
        conversionRate: 0.2,
      },
    });
  }

  // 5) Orphan contacts — no associated deals
  let orphan = 0;
  const orSamples: { id: string; label: string }[] = [];
  for (const e of contacts) {
    const p = e.payload_json;
    const n = Number(p.num_associated_deals ?? 0);
    if (Number.isFinite(n) && n > 0) continue;
    orphan += 1;
    if (orSamples.length < 10) {
      orSamples.push({ id: String(p.id), label: `Contact ${String(p.id).slice(0, 8)}…` });
    }
  }
  if (orphan > 0) {
    await upsertValueEngineIssue(supabase, {
      org_id: orgId,
      revenue_impact_fallback: revenueImpactFallback,
      source: "hubspot",
      type: "hubspot_orphan_contacts",
      title: "Contacts with no associated deals",
      description: `${orphan} contact(s) have no associated deals.`,
      severity: "low",
      revenue_impact_cents: Math.round(orphan * avgDealCents * 0.08),
      affected_count: orphan,
      confidence: "medium",
      issue_key: buildIssueKey(orgId, "hubspot", "hubspot_orphan_contacts"),
      metadata: { sampleRecords: orSamples },
    });
  }

  return { ok: true };
}
