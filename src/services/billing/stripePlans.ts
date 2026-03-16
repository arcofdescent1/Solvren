import { env } from "@/lib/env";

/** Map Stripe price IDs to plan tiers. Populate from env or config. */
export function getPlanByPriceId(): Record<string, "PRO" | "BUSINESS"> {
  const map: Record<string, "PRO" | "BUSINESS"> = {};
  const team = env.stripePriceTeam;
  const business = env.stripePriceBusiness;
  if (team) map[team] = "PRO";
  if (business) map[business] = "BUSINESS";
  return map;
}

export function tierFromPriceId(priceId: string | null): "FREE" | "PRO" | "BUSINESS" {
  if (!priceId) return "FREE";
  return getPlanByPriceId()[priceId] ?? "FREE";
}
