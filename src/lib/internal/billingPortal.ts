import { getStripe } from "@/lib/stripe";

export type BillingRow = {
  stripe_customer_id: string | null;
  status: string;
  plan_key: string;
  current_period_end: string | null;
};

export function computePortalEligible(billing: BillingRow | null): boolean {
  if (!getStripe() || !billing?.stripe_customer_id) return false;
  const st = (billing.status ?? "").toUpperCase();
  if (st === "CANCELED" || st === "CANCELLED") return false;
  return true;
}
