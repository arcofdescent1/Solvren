import { env } from "@/lib/env";
import { normalizeLicenseTier, type LicenseTier } from "@/services/licensing";

/** Map Stripe price IDs to plan tiers. Populate from env or config. */
export function getPlanByPriceId(): Record<string, Extract<LicenseTier, "TEAM" | "BUSINESS">> {
  const map: Record<string, Extract<LicenseTier, "TEAM" | "BUSINESS">> = {};
  const team = env.stripePriceTeam;
  const business = env.stripePriceBusiness;
  if (team) map[team] = "TEAM";
  if (business) map[business] = "BUSINESS";
  return map;
}

export function tierFromPriceId(priceId: string | null): LicenseTier {
  if (!priceId) return "FREE";
  return normalizeLicenseTier(getPlanByPriceId()[priceId] ?? "FREE");
}
