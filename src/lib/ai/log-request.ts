/**
 * Log AI API requests to ai_requests for observability and cost control (Gap 4).
 * Call this from AI routes after the LLM call (or on error).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export type LogAiRequestParams = {
  endpoint: string;
  inputSummary: string | null;
  outputSummary: string | null;
  latencyMs: number | null;
  status: "ok" | "error" | "timeout" | "disabled";
  userId?: string | null;
  orgId?: string | null;
};

const MAX_SUMMARY_LEN = 2000;

function truncate(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = String(s).trim();
  return t.length > MAX_SUMMARY_LEN ? t.slice(0, MAX_SUMMARY_LEN) + "…" : t || null;
}

export async function logAiRequest(
  supabase: SupabaseClient,
  params: LogAiRequestParams
): Promise<void> {
  try {
    await supabase.from("ai_requests").insert({
      endpoint: params.endpoint,
      input_summary: truncate(params.inputSummary),
      output_summary: truncate(params.outputSummary),
      latency_ms: params.latencyMs,
      status: params.status,
      user_id: params.userId ?? null,
      org_id: params.orgId ?? null,
    });
  } catch {
    // Best-effort; do not fail the request if logging fails
  }
}

/** Check whether today's AI request count is under the configured daily limit. */
export async function checkAiDailyLimit(supabase: SupabaseClient): Promise<{ allowed: boolean; count: number }> {
  const limit = env.aiDailyRequestLimit;
  if (limit == null) return { allowed: true, count: 0 };

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const since = today.toISOString();

  const { count, error } = await supabase
    .from("ai_requests")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);

  const countToday = error ? 0 : (count ?? 0);
  return { allowed: countToday < limit, count: countToday };
}
