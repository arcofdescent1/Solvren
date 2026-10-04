import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { reportCsv, reportPdf, ReportPacket } from "./report-packet";

const packet: ReportPacket = {
  organization: "Acme", periodStart: "2026-10-01", periodEnd: "2026-11-01",
  generatedAt: "2026-11-02T00:00:00Z", formulaVersion: "2026-10-v2",
  confidence: "verified", portfolio: [{
    customer_id: "a", customer_name: "=Unsafe Name", customer_external_id: "a",
    owner_email: null, renewal_on: null, revenue_usd: "100.00", known_cost_usd: "25.00",
    model_cost_usd: "25", tool_cost_usd: "0", human_cost_usd: "0", other_cost_usd: "0",
    completed_outcomes: 1, failed_outcomes: 0, usage_events: 1,
    unknown_cost_events: 0, target_margin_pct: "30", latest_event_at: null, top_workflow: "answer",
  }], reconciliation: [{ provider: "openai", source: "connector", reported_usd: "25.00",
    attributed_usd: "25.00", variance_usd: "0.00", covered_days: 31, total_days: 31,
    unmapped_events: 0, unpriced_events: 0, status: "verified" }],
  unmapped: [], contracts: [], mappings: [{ source: "stripe", source_customer_id: "cus_1",
    customer_id: "a" }], providerCostBuckets: [], rateCards: [], exceptions: [],
};

it("creates an immutable packet's actual PDF and a formula-safe CSV", async () => {
  const csv = reportCsv(packet);
  expect(csv).toContain("'=Unsafe Name");
  expect(csv).toContain("75.00");
  expect(csv).toContain("customer_mapping");
  const pdf = await reportPdf(packet);
  expect(Buffer.from(pdf).subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.byteLength).toBeGreaterThan(1000);
});
