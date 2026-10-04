import { describe, expect, it } from "vitest";
import { normalizeCostPage } from "./provider-cost";
import { normalizeStripePage } from "./stripe-revenue";

describe("supplier cost normalization", () => {
  it("keeps OpenAI project and line-item cost in USD", () => {
    const page = normalizeCostPage("openai", { data: [{
      start_time: 1790812800, end_time: 1790899200,
      results: [{ amount: { value: 12.34, currency: "usd" }, project_id: "proj_a", line_item: "inference" }],
    }], has_more: false, next_page: null }, "2026-10-01");
    expect(page.buckets).toEqual([{ scopeId: "proj_a", lineItem: "inference", amountUsd: "12.34000000" }]);
  });
  it("converts Anthropic fractional cents to USD without rounding cents early", () => {
    const page = normalizeCostPage("anthropic", { data: [{
      starting_at: "2026-10-01T00:00:00Z", ending_at: "2026-10-02T00:00:00Z",
      results: [{ amount: "123.78912", currency: "USD", workspace_id: "wrk_1", description: "Tokens" }],
    }], has_more: false, next_page: null }, "2026-10-01");
    expect(page.buckets[0].amountUsd).toBe("1.23789120");
  });
});

describe("read-only Stripe revenue evidence", () => {
  it("does not turn metered or mixed subscription prices into a contract fee", () => {
    const page = normalizeStripePage("subscriptions", { data: [{ id: "sub_1", customer: "cus_1",
      status: "active", currency: "usd", items: { has_more: false, data: [{ quantity: 2,
        price: { currency: "usd", unit_amount: 5000, recurring: { interval: "month", interval_count: 1, usage_type: "metered" } },
      }] }, discount: { id: "di_1" }, latest_invoice: "in_1",
    }], has_more: false });
    expect(page.rows[0].gross_recurring_usd).toBeNull();
    expect(page.rows[0].discount_note).toContain("Metered");
    expect(page.rows[0].discount_note).toContain("discounts");
  });
  it("retains invoice discounts and credit notes as separate evidence", () => {
    const page = normalizeStripePage("invoices", { data: [{ id: "in_1", customer: "cus_1",
      currency: "usd", status: "paid", subtotal: 10000, total: 8700,
      total_discount_amounts: [{ amount: 1000 }], pre_payment_credit_notes_amount: 300,
    }], has_more: false });
    expect(page.rows[0].discount_usd).toBe("10.00");
    expect(page.rows[0].credit_usd).toBe("3.00");
    expect(page.rows[0].total_usd).toBe("87.00");
  });
  it("does not present a foreign-currency invoice as USD", () => {
    const page = normalizeStripePage("invoices", { data: [{ id: "in_2", customer: "cus_1",
      currency: "jpy", status: "paid", subtotal: 10000, total: 8700,
      total_discount_amounts: [{ amount: 1000 }],
    }], has_more: false });
    expect(page.rows[0].currency).toBe("JPY");
    expect(page.rows[0].subtotal_usd).toBeNull();
    expect(page.rows[0].discount_usd).toBeNull();
    expect(page.rows[0].total_usd).toBeNull();
  });
});
