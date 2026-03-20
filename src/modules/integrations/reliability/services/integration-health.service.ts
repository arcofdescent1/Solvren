/**
 * Gap 4 — Integration health from action execution results (§12).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

function integrationKey(orgId: string, provider: string): string {
  return `${orgId}:${provider}`;
}

export async function recordExecutionSuccess(
  supabase: SupabaseClient,
  orgId: string,
  provider: string,
  latencyMs?: number
): Promise<void> {
  const key = integrationKey(orgId, provider);
  const { data: existing } = await supabase
    .from("integration_health")
    .select("error_rate, avg_latency_ms")
    .eq("integration_key", key)
    .maybeSingle();

  const avgLatency = existing?.avg_latency_ms != null
    ? (Number(existing.avg_latency_ms) + (latencyMs ?? 0)) / 2
    : latencyMs ?? null;

  await supabase
    .from("integration_health")
    .upsert(
      {
        integration_key: key,
        org_id: orgId,
        provider,
        status: "healthy",
        last_success: new Date().toISOString(),
        error_rate: Math.max(0, (Number(existing?.error_rate) ?? 0) * 0.95),
        avg_latency_ms: avgLatency,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "integration_key" }
    );
}

export async function recordExecutionFailure(
  supabase: SupabaseClient,
  orgId: string,
  provider: string
): Promise<void> {
  const key = integrationKey(orgId, provider);
  const { data: existing } = await supabase
    .from("integration_health")
    .select("error_rate")
    .eq("integration_key", key)
    .maybeSingle();

  const newRate = Math.min(1, (Number(existing?.error_rate) ?? 0) * 0.8 + 0.2);

  let status: "healthy" | "degraded" | "down" = "healthy";
  if (newRate >= 0.1) status = "down";
  else if (newRate >= 0.02) status = "degraded";

  await supabase
    .from("integration_health")
    .upsert(
      {
        integration_key: key,
        org_id: orgId,
        provider,
        status,
        last_failure: new Date().toISOString(),
        error_rate: newRate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "integration_key" }
    );
}
