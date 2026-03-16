import Stripe from "stripe";
import { env } from "@/lib/env";

let stripeInstance: Stripe | null = null;

/**
 * Returns Stripe client when billing is configured. Null when disabled.
 * Never use placeholder keys - missing config = feature disabled.
 */
export function getStripe(): Stripe | null {
  if (!env.billingEnabled) return null;
  if (!stripeInstance) {
    const key = env.stripeSecretKey;
    if (!key) return null;
    stripeInstance = new Stripe(key, {
      apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
    });
  }
  return stripeInstance;
}
