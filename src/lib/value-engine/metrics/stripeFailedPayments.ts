/**
 * Shared metrics for Stripe failed payments (value engine + Phase 4 verification).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

type RawEv = { event_type: string; occurred_at: string; payload_json: Record<string, unknown> };

const MS_7D = 7 * 24 * 60 * 60 * 1000;

function parsePayload(r: RawEv) {
  return r.payload_json ?? {};
}

function inWindow(iso: string, since: string) {
  return iso >= since;
}

/** Failed PIs + invoice_failed in last 7d (same window as detector). */
export async function measureStripeFailedPayments(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ count: number; amountCents: number }> {
  const now = Date.now();
  const since7 = new Date(now - MS_7D).toISOString();

  const { data: rows, error } = await supabase
    .from("raw_events")
    .select("event_type, occurred_at, payload_json")
    .eq("org_id", orgId)
    .eq("provider", "stripe")
    .gte("occurred_at", new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString());

  if (error) throw new Error(error.message);
  const evs = (rows ?? []) as RawEv[];
  const piRows = evs.filter((r) => r.event_type === "stripe_pi");
  const invRows = evs.filter((r) => r.event_type === "stripe_invoice_failed");

  const failedPiIds = new Map<string, number>();
  for (const r of piRows) {
    if (!inWindow(r.occurred_at, since7)) continue;
    const p = parsePayload(r);
    const status = String(p.status ?? "");
    if (status === "requires_payment_method" || status === "requires_action") {
      const id = String(p.id ?? "");
      const amt = Number(p.amount ?? 0);
      const prev = failedPiIds.get(id) ?? 0;
      failedPiIds.set(id, Math.max(prev, amt));
    }
  }
  for (const r of invRows) {
    if (!inWindow(r.occurred_at, since7)) continue;
    const p = parsePayload(r);
    const id = String(p.id ?? "inv");
    const amt = Number(p.amount_due ?? 0);
    failedPiIds.set(`inv:${id}`, (failedPiIds.get(`inv:${id}`) ?? 0) + amt);
  }

  let amountCents = 0;
  for (const [, v] of failedPiIds) amountCents += v;
  return { count: failedPiIds.size, amountCents };
}
