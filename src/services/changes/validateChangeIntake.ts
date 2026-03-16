const REQUIRED_SYSTEMS_MIN = 1;

export function validateChangeIntake(change: Record<string, unknown> | null | undefined) {
  const errors: string[] = [];

  const req = (name: string, ok: boolean) => {
    if (!ok) errors.push(`Missing/invalid: ${name}`);
  };

  if (!change) {
    return { ok: false as const, errors: ["Change not found"] };
  }

  req("change_type", !!(change.change_type ?? change.structured_change_type));
  req(
    "systems_involved",
    Array.isArray(change.systems_involved) && change.systems_involved.length >= REQUIRED_SYSTEMS_MIN
  );
  req("rollout_method", !!change.rollout_method);
  req("backfill_required", typeof change.backfill_required === "boolean");
  req("customer_impact_expected", typeof change.customer_impact_expected === "boolean");
  req("planned_release_at", !!(change.planned_release_at ?? change.requested_release_at));

  if (change.customer_impact_expected === true) {
    req(
      "affected_customer_segments",
      Array.isArray(change.affected_customer_segments) && change.affected_customer_segments.length > 0
    );
  }

  const domain = (change.domain ?? "REVENUE") as string;
  if (domain === "REVENUE") {
    req("revenue_surface", !!change.revenue_surface);
    req(
      "estimated_mrr_affected",
      change.estimated_mrr_affected != null && Number(change.estimated_mrr_affected) >= 0
    );
    req(
      "percent_customer_base_affected",
      change.percent_customer_base_affected != null && Number(change.percent_customer_base_affected) >= 0
    );
  }

  if (errors.length) {
    return { ok: false as const, errors };
  }
  return { ok: true as const };
}
