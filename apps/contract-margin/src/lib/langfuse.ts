import Decimal from "decimal.js";
import { z } from "zod";
import { usageRow } from "./import-schemas";

export const langfuseRegions: Record<string, string> = {
  us: "https://us.cloud.langfuse.com",
  eu: "https://cloud.langfuse.com",
  jp: "https://jp.cloud.langfuse.com",
  hipaa_us: "https://hipaa.cloud.langfuse.com",
};

const observation = z.object({
  id: z.string(), traceId: z.string(), startTime: z.string(),
  type: z.string(), userId: z.string().nullable().optional(),
  traceName: z.string().nullable().optional(), model: z.string().nullable().optional(),
  level: z.string().nullable().optional(),
  usageDetails: z.record(z.string(), z.number()).nullable().optional(),
  inputUsage: z.number().nullable().optional(), outputUsage: z.number().nullable().optional(),
  totalCost: z.union([z.number(), z.string()]).nullable().optional(),
}).passthrough();

function units(details: Record<string, number> | null | undefined, keys: string[], fallback = 0) {
  for (const key of keys) if (details?.[key] !== undefined) return details[key];
  return fallback;
}

export function normalizeLangfuseObservation(value: unknown, provider: "openai" | "anthropic") {
  const parsed = observation.safeParse(value);
  if (!parsed.success) return { error: "Observation fields are invalid" } as const;
  const item = parsed.data;
  if (!['GENERATION', 'EMBEDDING'].includes(item.type.toUpperCase())) return { skipped: true } as const;
  let cost: string | undefined;
  if (item.totalCost !== null && item.totalCost !== undefined) {
    try {
      const amount = new Decimal(item.totalCost);
      if (!amount.isFinite() || amount.isNegative()) return { error: "Cost must be nonnegative" } as const;
      cost = amount.toDecimalPlaces(8, Decimal.ROUND_HALF_UP).toFixed(8);
    } catch { return { error: "Cost is invalid" } as const; }
  }
  const d = item.usageDetails;
  const candidate = {
    eventId: item.id,
    customerId: item.userId ?? "",
    workflowId: item.traceName ?? "",
    runId: item.traceId,
    occurredAt: item.startTime,
    provider,
    billingRoute: provider === "openai" ? "openai_direct" : "anthropic_direct",
    model: item.model ?? "",
    inputTokens: units(d, ["input"], item.inputUsage ?? 0),
    outputTokens: units(d, ["output"], item.outputUsage ?? 0),
    cacheReadTokens: units(d, ["input_cached_tokens", "cache_read_input_tokens", "cache_read"]),
    cacheWriteTokens: units(d, ["input_cache_creation_tokens", "cache_creation_input_tokens", "cache_write"]),
    reasoningOutputTokens: units(d, ["output_reasoning_tokens", "reasoning_output_tokens"]),
    reportedCostUsd: cost,
    status: item.level?.toUpperCase() === "ERROR" ? "failed" : "succeeded",
  };
  const checked = usageRow.safeParse(candidate);
  if (!checked.success) return { error: checked.error.issues.map((issue) => issue.path.join(".")).join(", ").slice(0, 300) } as const;
  return { row: checked.data } as const;
}
