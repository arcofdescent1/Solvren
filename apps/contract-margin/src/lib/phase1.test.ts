import { describe, expect, it } from "vitest";
import { parseImportCsv, validateRows } from "./import-schemas";
import { contribution, exposure, PortfolioRow, riskStatus, usd } from "./finance";
import { normalizeLangfuseObservation } from "./langfuse";

const sample: PortfolioRow = {
  customer_id: "c", customer_name: "Acme", customer_external_id: "acme",
  owner_email: null, renewal_on: null, revenue_usd: "1000.00", known_cost_usd: "810.00",
  model_cost_usd: "800", tool_cost_usd: "10", human_cost_usd: "0", other_cost_usd: "0",
  completed_outcomes: 10, failed_outcomes: 2, usage_events: 12, unknown_cost_events: 0,
  target_margin_pct: "30", latest_event_at: null, top_workflow: "answer",
};

describe("financial presentation", () => {
  it("reports known margin exposure with exact decimal arithmetic", () => {
    expect(contribution(sample).toString()).toBe("190");
    expect(exposure(sample).toString()).toBe("110");
    expect(riskStatus(sample)).toBe("Below floor");
    expect(usd("1234567.235")).toBe("$1,234,567.24");
  });
  it("does not imply an unpriced contract is safely above its floor", () => {
    expect(riskStatus({ ...sample, known_cost_usd: "100", unknown_cost_events: 1 })).toBe("Cost incomplete");
  });
});

describe("metadata-only imports", () => {
  it("rejects a CSV that includes prompt content", () => {
    expect(() => parseImportCsv("eventId,prompt\n1,secret", "usage")).toThrow(/Content/);
  });
  it("quarantines invalid rows without keeping their payload", () => {
    const result = parseImportCsv("eventId,customerId,workflowId,runId,occurredAt,status\ne1,c1,w1,r1,2026-10-04T00:00:00Z,completed\ne2,c1,w1,r2,2026-10-04T00:00:00Z,unknown", "outcomes");
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].row_number).toBe(3);
    expect(JSON.stringify(result.rejected)).not.toContain("unknown");
  });
  it("rejects the wrong provider for a direct billing route", () => {
    const result = validateRows("usage", [{
      eventId: "e", customerId: "c", workflowId: "w", runId: "r", occurredAt: "2026-10-04T00:00:00Z",
      provider: "anthropic", billingRoute: "openai_direct", model: "claude", inputTokens: 1,
      outputTokens: 1, status: "succeeded",
    }]);
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
  });
});

describe("Langfuse observation normalization", () => {
  it("uses mutually exclusive usage buckets and never carries IO content", () => {
    const result = normalizeLangfuseObservation({
      id: "obs-1", traceId: "run-1", startTime: "2026-10-04T00:00:00Z",
      type: "GENERATION", userId: "customer-1", traceName: "answer", model: "gpt-4.1",
      usageDetails: { input: 86, input_cached_tokens: 17817, output: 188, output_reasoning_tokens: 12 },
      totalCost: "0.00420000", input: "private prompt", output: "private answer",
    }, "openai");
    expect(result.row?.inputTokens).toBe(86);
    expect(result.row?.cacheReadTokens).toBe(17817);
    expect(result.row?.reasoningOutputTokens).toBe(12);
    expect(JSON.stringify(result.row)).not.toContain("private");
  });
});
