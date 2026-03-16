/**
 * Phase C5 — Risk Alert Engine
 * Creates alerts when risk_score > threshold; delivery via Slack/Email/PagerDuty.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const ALERT_THRESHOLD_SCORE = 90;
const ALERT_BUCKETS = ["HIGH", "CRITICAL"] as const;

export async function createRiskAlertIfNeeded(
  client: SupabaseClient,
  orgId: string,
  riskEventId: string,
  riskScore: number,
  riskBucket: string
): Promise<string | null> {
  const exceedsScore = riskScore >= ALERT_THRESHOLD_SCORE;
  const isHighRisk = ALERT_BUCKETS.includes(riskBucket as (typeof ALERT_BUCKETS)[number]);
  if (!exceedsScore && !isHighRisk) return null;

  const { data, error } = await client
    .from("risk_alerts")
    .insert({
      org_id: orgId,
      risk_event_id: riskEventId,
      alert_type: "risk_threshold",
      status: "open",
      metadata: { risk_score: riskScore, risk_bucket: riskBucket },
    })
    .select("id")
    .single();

  if (error) return null;
  return (data as { id: string })?.id ?? null;
}
