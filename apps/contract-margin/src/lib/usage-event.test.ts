import { describe, expect, it } from "vitest";
import { parseUsageEvent } from "./usage-event";

const valid = {
  eventId: "evt_1", organizationId: "dd68f132-4913-4333-bcc5-338577a02fb6",
  customerId: "acme", workflowId: "review", runId: "run_1", provider: "openai",
  billingRoute: "openai_direct",
  model: "gpt-4.1", inputTokens: 14, outputTokens: 3,
  occurredAt: "2026-10-04T12:00:00Z", status: "succeeded",
};

describe("metadata-only usage contract", () => {
  it("accepts a complete metadata event", () => expect(parseUsageEvent(valid)).toEqual(valid));
  it("rejects prompt and response content instead of silently persisting it", () => {
    expect(() => parseUsageEvent({ ...valid, prompt: "private text" })).toThrow();
    expect(() => parseUsageEvent({ ...valid, response: "private text" })).toThrow();
  });
  it("rejects negative token counts", () => {
    expect(() => parseUsageEvent({ ...valid, inputTokens: -1 })).toThrow();
  });
  it("rejects a billing route that would misattribute supplier cost", () => {
    expect(() => parseUsageEvent({ ...valid, billingRoute: "anthropic_direct" })).toThrow();
  });
  it("accepts exact decimal cost text rather than a floating point cost", () => {
    expect(parseUsageEvent({ ...valid, reportedCostUsd: "0.00123456" }).reportedCostUsd).toBe("0.00123456");
    expect(() => parseUsageEvent({ ...valid, reportedCostUsd: 0.00123456 })).toThrow();
  });
});
