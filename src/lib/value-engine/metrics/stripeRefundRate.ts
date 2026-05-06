import type { SupabaseClient } from "@supabase/supabase-js";

type RawEv = { event_type: string; occurred_at: string; payload_json: Record<string, unknown> };

const MS_30D = 30 * 24 * 60 * 60 * 1000;

/** Refund sum / charge paid sum over 30d, plus raw counts. */
export async function measureStripeRefundRate(
  supabase: SupabaseClient,
  orgId: string
): Promise<{
  refundSumCents: number;
  chargePaidSumCents: number;
  refundRate: number;
  refundCount: number;
}> {
  const now = Date.now();
  const since30 = new Date(now - MS_30D).toISOString();

  const { data: rows, error } = await supabase
    .from("raw_events")
    .select("event_type, occurred_at, payload_json")
    .eq("org_id", orgId)
    .eq("provider", "stripe")
    .gte("occurred_at", since30);

  if (error) throw new Error(error.message);
  const evs = (rows ?? []) as RawEv[];
  let refundSum = 0;
  let chargePaidSum = 0;
  let refundCount = 0;
  for (const r of evs) {
    if (r.event_type === "stripe_refund") {
      refundSum += Number(r.payload_json.amount ?? 0);
      refundCount += 1;
    }
    if (r.event_type === "stripe_charge" && r.payload_json.paid === true) {
      chargePaidSum += Number(r.payload_json.amount ?? 0);
    }
  }
  const refundRate = chargePaidSum > 0 ? refundSum / chargePaidSum : 0;
  return { refundSumCents: refundSum, chargePaidSumCents: chargePaidSum, refundRate, refundCount };
}
