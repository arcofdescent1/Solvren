/**
 * Phase 3 — Stripe webhook signature validator (§10).
 */
import type Stripe from "stripe";

export type StripeValidatorResult = { valid: boolean; payload?: Stripe.Event; error?: string };

export function validateStripeWebhook(
  stripe: Stripe | null,
  rawBody: string,
  signature: string | null,
  secret: string | null
): StripeValidatorResult {
  if (!stripe || !secret) return { valid: false, error: "Stripe webhook not configured" };
  if (!signature) return { valid: false, error: "Missing stripe-signature header" };

  try {
    const event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    return { valid: true, payload: event };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : "Invalid signature" };
  }
}
