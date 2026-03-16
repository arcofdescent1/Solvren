export type PlanTier = "FREE" | "PRO" | "BUSINESS";

/** Normalize plan string; maps TEAM → PRO for backward compat with billing_accounts.plan_key */
export function planFromString(v: unknown): PlanTier {
  const s = String(v ?? "").toUpperCase();
  if (s === "BUSINESS") return "BUSINESS";
  if (s === "PRO" || s === "TEAM") return "PRO";
  return "FREE";
}

export function isPaidActive(plan: PlanTier, status?: string | null): boolean {
  if (plan === "FREE") return false;
  const s = (status ?? "ACTIVE").toUpperCase();
  return s === "ACTIVE" || s === "TRIALING" || s === "PAST_DUE";
}

export function canUseSlack(plan: PlanTier, status?: string | null) {
  return (plan === "PRO" || plan === "BUSINESS") && isPaidActive(plan, status);
}

export function canUseEmail(plan: PlanTier, status?: string | null) {
  return plan === "BUSINESS" && isPaidActive(plan, status);
}

export function canUseWeeklyDigest(plan: PlanTier, status?: string | null) {
  return plan === "BUSINESS" && isPaidActive(plan, status);
}
