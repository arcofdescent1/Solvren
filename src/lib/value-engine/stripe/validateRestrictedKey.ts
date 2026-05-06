import Stripe from "stripe";

/**
 * Phase 1 — accept restricted API keys (rk_*) with read access to payment intents and charges.
 */
export async function validateRestrictedStripeKey(secretKey: string): Promise<
  | { ok: true; stripe: Stripe; accountId: string }
  | { ok: false; error: string }
> {
  const trimmed = secretKey.trim();
  if (!trimmed.startsWith("rk_")) {
    return { ok: false, error: "Only restricted API keys (rk_...) are accepted in Phase 1." };
  }

  const stripe = new Stripe(trimmed, { apiVersion: "2024-06-20" as Stripe.LatestApiVersion });
  try {
    // Restricted keys may not allow /v1/account; require read on PaymentIntents + Charges only.
    await stripe.paymentIntents.list({ limit: 1 });
    await stripe.charges.list({ limit: 1 });
    return { ok: true, stripe, accountId: "rk_validated" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Stripe API validation failed" };
  }
}
