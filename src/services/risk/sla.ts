import type { SupabaseClient } from "@supabase/supabase-js";

export type RiskBucket =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "VERY_HIGH"
  | "CRITICAL";

export type RiskDomain =
  | "REVENUE"
  | "DATA"
  | "WORKFLOW"
  | "SECURITY";

function isRiskDomain(v: string): v is RiskDomain {
  return (
    v === "REVENUE" ||
    v === "DATA" ||
    v === "WORKFLOW" ||
    v === "SECURITY"
  );
}

/**
 * Compute due_at from domain template + risk bucket.
 * Rules:
 * - Base = domain_templates.default_sla_hours (fallback 72)
 * - CRITICAL = 4 hours (unchanged)
 * - VERY_HIGH/HIGH/LOW = business-day targets (unchanged)
 * - MEDIUM = base hours
 */
export async function computeDueAt(
  supabase: SupabaseClient,
  domain: string,
  riskBucket: string | null,
  submittedAt: Date
): Promise<Date | null> {
  const normDomain = isRiskDomain(String(domain).toUpperCase())
    ? (String(domain).toUpperCase() as RiskDomain)
    : "REVENUE";

  let defaultHours = 72;
  try {
    const { data: tpl } = await supabase
      .from("domain_templates")
      .select("default_sla_hours")
      .eq("domain", normDomain)
      .eq("enabled", true)
      .maybeSingle();

    const hours = Number(
      (tpl as { default_sla_hours?: number } | null)?.default_sla_hours
    );
    if (Number.isFinite(hours) && hours > 0) defaultHours = hours;
  } catch {
    // ignore, fallback defaultHours
  }

  const b = (riskBucket ?? "MEDIUM") as RiskBucket;
  const due = new Date(submittedAt);

  const addBusinessDays = (days: number) => {
    let remaining = days;
    while (remaining > 0) {
      due.setDate(due.getDate() + 1);
      const day = due.getDay();
      if (day !== 0 && day !== 6) remaining--;
    }
  };

  // Tier semantics (keep yours, just more robust)
  if (b === "CRITICAL") {
    due.setTime(due.getTime() + 4 * 3600 * 1000);
    return due;
  }
  if (b === "VERY_HIGH") {
    addBusinessDays(1);
    return due;
  }
  if (b === "HIGH") {
    addBusinessDays(2);
    return due;
  }
  if (b === "LOW") {
    addBusinessDays(5);
    return due;
  }

  // MEDIUM / default
  due.setTime(due.getTime() + defaultHours * 3600 * 1000);
  return due;
}
