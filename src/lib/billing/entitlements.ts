export type PlanKey = "FREE" | "TEAM" | "BUSINESS";

export function isPaidActive(
  plan: PlanKey,
  status: string | null | undefined
) {
  if (plan === "FREE") return false;
  const s = (status ?? "ACTIVE").toUpperCase();
  return s === "ACTIVE" || s === "TRIALING" || s === "PAST_DUE";
}

export function canUseSlack(
  plan: PlanKey,
  status: string | null | undefined
) {
  return isPaidActive(plan, status) && (plan === "TEAM" || plan === "BUSINESS");
}

/** Email alerts (approval requested, overdue, etc.) — TEAM+ only */
export function canUseEmailNotifications(
  plan: PlanKey,
  status: string | null | undefined
) {
  return isPaidActive(plan, status) && (plan === "TEAM" || plan === "BUSINESS");
}

export function canUseWeeklyDigest(
  plan: PlanKey,
  status: string | null | undefined
) {
  return isPaidActive(plan, status) && (plan === "TEAM" || plan === "BUSINESS");
}

export function canUseEscalations(
  plan: PlanKey,
  status: string | null | undefined
) {
  return isPaidActive(plan, status) && plan === "BUSINESS";
}
