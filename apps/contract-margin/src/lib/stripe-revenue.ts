import Decimal from "decimal.js";
import { z } from "zod";

export type StripeStage = "customers" | "subscriptions" | "invoices";
const stripeList = z.object({ data: z.array(z.unknown()).max(100), has_more: z.boolean() });
const stripeCustomer = z.object({ id: z.string(), name: z.string().nullable().optional(),
  email: z.string().nullable().optional() });
const stripeSubscription = z.object({
  id: z.string(), customer: z.union([z.string(), z.object({ id: z.string() })]),
  status: z.string(), currency: z.string().optional(),
  items: z.object({ data: z.array(z.object({ quantity: z.number().nullable().optional(),
    price: z.object({ unit_amount: z.number().nullable().optional(),
      currency: z.string(), recurring: z.object({ interval: z.string(),
        interval_count: z.number().int().positive(), usage_type: z.string().optional() }).nullable().optional(),
    }) })), has_more: z.boolean().optional() }),
  discount: z.unknown().nullable().optional(), discounts: z.array(z.unknown()).optional(),
  latest_invoice: z.union([z.string(), z.object({ id: z.string() })]).nullable().optional(),
});
const stripeInvoice = z.object({
  id: z.string(), customer: z.union([z.string(), z.object({ id: z.string() })]),
  subscription: z.union([z.string(), z.object({ id: z.string() })]).nullable().optional(),
  currency: z.string(), status: z.string().nullable().optional(),
  subtotal: z.number().int(), total: z.number().int(),
  total_discount_amounts: z.array(z.object({ amount: z.number().int() })).nullable().optional(),
  pre_payment_credit_notes_amount: z.number().int().nullable().optional(),
  post_payment_credit_notes_amount: z.number().int().nullable().optional(),
  period_start: z.number().int().nullable().optional(),
  period_end: z.number().int().nullable().optional(),
});
function id(value: string | { id: string }) { return typeof value === "string" ? value : value.id; }
function dollars(cents: number) { return new Decimal(cents).div(100).toFixed(2); }

type Page<T> = { rows: T[]; hasMore: boolean; cursor: string | null };
type CustomerRow = { stripe_customer_id: string; display_name: string | null; email: string | null };
type SubscriptionRow = { stripe_subscription_id: string; stripe_customer_id: string; status: string;
  currency: string; interval: string | null; interval_count: number | null;
  gross_recurring_usd: string | null; discount_note: string | null; latest_invoice_id: string | null };
type InvoiceRow = { stripe_invoice_id: string; stripe_customer_id: string; stripe_subscription_id: string | null;
  currency: string; status: string; subtotal_usd: string | null; discount_usd: string | null; credit_usd: string | null;
  total_usd: string | null; period_start: string | null; period_end: string | null };

export function normalizeStripePage(stage: "customers", raw: unknown): Page<CustomerRow>;
export function normalizeStripePage(stage: "subscriptions", raw: unknown): Page<SubscriptionRow>;
export function normalizeStripePage(stage: "invoices", raw: unknown): Page<InvoiceRow>;
export function normalizeStripePage(stage: StripeStage, raw: unknown): Page<CustomerRow | SubscriptionRow | InvoiceRow>;
export function normalizeStripePage(stage: StripeStage, raw: unknown) {
  const page = stripeList.parse(raw);
  if (page.has_more && page.data.length === 0) throw new Error("Stripe pagination did not advance");
  if (stage === "customers") return { rows: page.data.map((item) => {
    const customer = stripeCustomer.parse(item);
    return { stripe_customer_id: customer.id, display_name: customer.name ?? null,
      email: customer.email ?? null };
  }), hasMore: page.has_more, cursor: page.data.length ? stripeCustomer.parse(page.data.at(-1)).id : null };
  if (stage === "subscriptions") return { rows: page.data.map((item) => {
    const subscription = stripeSubscription.parse(item);
    const prices = subscription.items.data;
    const currency = subscription.currency ?? prices[0]?.price.currency ?? "";
    const intervals = new Set(prices.map((value) => `${value.price.recurring?.interval}/${value.price.recurring?.interval_count}`));
    const calculable = !subscription.items.has_more && prices.length > 0 && intervals.size === 1
      && prices.every((value) => value.price.unit_amount !== null
        && value.price.unit_amount !== undefined && value.price.recurring?.usage_type !== "metered"
        && value.price.currency === currency);
    const gross = calculable ? prices.reduce((sum, value) => sum.plus(
      new Decimal(value.price.unit_amount!).times(value.quantity ?? 1)), new Decimal(0)) : null;
    const recurring = prices[0]?.price.recurring;
    const notes = [];
    if (!calculable) notes.push("Metered, mixed, or truncated items require contract review");
    if (subscription.discount || subscription.discounts?.length) notes.push("Subscription discounts present; use invoices to review actual credits");
    return { stripe_subscription_id: subscription.id,
      stripe_customer_id: id(subscription.customer), status: subscription.status,
      currency: currency.toUpperCase(), interval: recurring?.interval ?? null,
      interval_count: recurring?.interval_count ?? null,
      gross_recurring_usd: currency.toLowerCase() === "usd" && gross ? gross.div(100).toFixed(2) : null,
      discount_note: notes.join(". ") || null,
      latest_invoice_id: subscription.latest_invoice ? id(subscription.latest_invoice) : null };
  }), hasMore: page.has_more, cursor: page.data.length ? stripeSubscription.parse(page.data.at(-1)).id : null };
  return { rows: page.data.map((item) => {
    const invoice = stripeInvoice.parse(item);
    const isUsd = invoice.currency.toLowerCase() === "usd";
    return { stripe_invoice_id: invoice.id, stripe_customer_id: id(invoice.customer),
      stripe_subscription_id: invoice.subscription ? id(invoice.subscription) : null,
      currency: invoice.currency.toUpperCase(), status: invoice.status ?? "unknown",
      subtotal_usd: isUsd ? dollars(invoice.subtotal) : null,
      discount_usd: isUsd ? dollars((invoice.total_discount_amounts ?? []).reduce((sum, value) => sum + value.amount, 0)) : null,
      credit_usd: isUsd ? dollars((invoice.pre_payment_credit_notes_amount ?? 0)
        + (invoice.post_payment_credit_notes_amount ?? 0)) : null,
      total_usd: isUsd ? dollars(invoice.total) : null,
      period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
      period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
    };
  }), hasMore: page.has_more, cursor: page.data.length ? stripeInvoice.parse(page.data.at(-1)).id : null };
}

export async function fetchStripePage(key: string, stage: StripeStage, cursor: string | null) {
  const url = new URL(`https://api.stripe.com/v1/${stage}`);
  url.searchParams.set("limit", "100");
  if (cursor) url.searchParams.set("starting_after", cursor);
  if (stage === "subscriptions") url.searchParams.set("status", "all");
  if (stage === "invoices") {
    const yearAgo = Math.floor(Date.now() / 1000) - 400 * 86400;
    url.searchParams.set("created[gte]", String(yearAgo));
  }
  const response = await fetch(url, { headers: { Authorization: `Bearer ${key}` },
    cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Stripe ${stage} API returned HTTP ${response.status}`);
  return normalizeStripePage(stage, await response.json());
}

export async function verifyStripeKey(key: string) {
  if (!/^rk_(live|test)_[A-Za-z0-9]+$/.test(key)) throw new Error("Use a Stripe restricted key with read access only");
  for (const stage of ["customers", "subscriptions", "invoices"] as const)
    await fetchStripePage(key, stage, null);
}
