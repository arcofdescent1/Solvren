import Decimal from "decimal.js";
import { z } from "zod";

export type CostProvider = "openai" | "anthropic";
export type CostBucket = { scopeId: string; lineItem: string; amountUsd: string };

const openaiPage = z.object({
  data: z.array(z.object({
    start_time: z.number().int(), end_time: z.number().int(),
    results: z.array(z.object({
      amount: z.object({ value: z.number(), currency: z.string() }),
      project_id: z.string().nullable().optional(), line_item: z.string().nullable().optional(),
    })),
  })),
  has_more: z.boolean(), next_page: z.string().nullable().optional(),
});
const anthropicPage = z.object({
  data: z.array(z.object({
    starting_at: z.iso.datetime({ offset: true }), ending_at: z.iso.datetime({ offset: true }),
    results: z.array(z.object({
      amount: z.string(), currency: z.string(),
      workspace_id: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
    })),
  })),
  has_more: z.boolean(), next_page: z.string().nullable().optional(),
});

export function normalizeCostPage(provider: CostProvider, raw: unknown, day: string) {
  const buckets: CostBucket[] = [];
  let nextPage: string | null | undefined;
  let hasMore: boolean;
  if (provider === "openai") {
    const parsed = openaiPage.parse(raw);
    hasMore = parsed.has_more; nextPage = parsed.next_page;
    for (const bucket of parsed.data) {
      if (new Date(bucket.start_time * 1000).toISOString().slice(0, 10) !== day) continue;
      for (const item of bucket.results) {
        if (item.amount.currency.toLowerCase() !== "usd") throw new Error("OpenAI returned non-USD cost");
        buckets.push({ scopeId: item.project_id ?? "", lineItem: item.line_item ?? "",
          amountUsd: new Decimal(item.amount.value).toFixed(8) });
      }
    }
  } else {
    const parsed = anthropicPage.parse(raw);
    hasMore = parsed.has_more; nextPage = parsed.next_page;
    for (const bucket of parsed.data) {
      if (bucket.starting_at.slice(0, 10) !== day) continue;
      for (const item of bucket.results) {
        if (item.currency.toLowerCase() !== "usd") throw new Error("Anthropic returned non-USD cost");
        buckets.push({ scopeId: item.workspace_id ?? "", lineItem: item.description ?? "",
          amountUsd: new Decimal(item.amount).div(100).toFixed(8) });
      }
    }
  }
  if (hasMore && !nextPage) throw new Error(`${provider} cost cursor missing`);
  return { buckets, nextPage: hasMore ? nextPage! : null };
}

export async function fetchCostDay(provider: CostProvider, key: string, day: string) {
  const start = Math.floor(Date.parse(`${day}T00:00:00Z`) / 1000);
  const end = start + 86400;
  if (!Number.isFinite(start)) throw new Error("Invalid cost date");
  const grouped = new Map<string, Decimal>();
  let cursor: string | null = null;
  const seen = new Set<string>();
  for (let page = 0; page < 40; page++) {
    const url = provider === "openai"
      ? new URL("https://api.openai.com/v1/organization/costs")
      : new URL("https://api.anthropic.com/v1/organizations/cost_report");
    if (provider === "openai") {
      url.searchParams.set("start_time", String(start)); url.searchParams.set("end_time", String(end));
      url.searchParams.set("bucket_width", "1d"); url.searchParams.set("limit", "1");
      url.searchParams.append("group_by[]", "project_id"); url.searchParams.append("group_by[]", "line_item");
    } else {
      url.searchParams.set("starting_at", `${day}T00:00:00Z`);
      url.searchParams.set("ending_at", new Date(end * 1000).toISOString());
      url.searchParams.set("bucket_width", "1d"); url.searchParams.set("limit", "1");
      url.searchParams.append("group_by[]", "workspace_id");
      url.searchParams.append("group_by[]", "description");
    }
    if (cursor) url.searchParams.set(provider === "openai" ? "page" : "page", cursor);
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000),
      headers: provider === "openai"
        ? { Authorization: `Bearer ${key}` }
        : { "x-api-key": key, "anthropic-version": "2023-06-01",
          "User-Agent": "Solvren/1.0 (https://solvren.com)" },
    });
    if (!response.ok) throw new Error(`${provider} cost API returned HTTP ${response.status}`);
    const result = normalizeCostPage(provider, await response.json(), day);
    for (const bucket of result.buckets) {
      const id = `${bucket.scopeId}\u0000${bucket.lineItem}`;
      grouped.set(id, (grouped.get(id) ?? new Decimal(0)).plus(bucket.amountUsd));
    }
    if (!result.nextPage) return [...grouped].map(([id, amount]) => {
      const [scopeId, lineItem] = id.split("\u0000");
      return { scopeId, lineItem, amountUsd: amount.toFixed(8) };
    });
    if (seen.has(result.nextPage)) throw new Error(`${provider} cost cursor did not advance`);
    seen.add(result.nextPage); cursor = result.nextPage;
  }
  throw new Error(`${provider} cost report exceeded 40 pages`);
}
