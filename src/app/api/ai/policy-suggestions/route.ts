/**
 * AI Policy Suggestions — recommend policies based on recent high-risk events.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";

export async function GET(_req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) return NextResponse.json({ error: "No org" }, { status: 400 });

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data: riskRows } = await supabase
    .from("risk_events")
    .select("id, provider, risk_type, impact_amount, risk_bucket, approved_at")
    .eq("org_id", activeOrgId)
    .gte("timestamp", since.toISOString())
    .order("timestamp", { ascending: false })
    .limit(50);

  const risks = riskRows ?? [];
  const highRisk = risks.filter((r) => {
    const b = (r.risk_bucket ?? "").toUpperCase();
    return b === "HIGH" || b === "CRITICAL";
  });
  const unapproved = risks.filter((r) => !r.approved_at);

  const suggestions: Array<{ name: string; description: string; rule_type: string; enforcement_mode: string; rule_config?: Record<string, unknown> }> = [];

  if (highRisk.length >= 3) {
    const providers = [...new Set(highRisk.map((r) => r.provider))];
    suggestions.push({
      name: "Pricing change approval",
      description: `Based on ${highRisk.length} high-risk events from ${providers.join(", ")} in the last 30 days.`,
      rule_type: "PRICING_CHANGE",
      enforcement_mode: "REQUIRE_APPROVAL",
      rule_config: { systems: providers },
    });
  }

  const pricingRisks = risks.filter((r) => (r.risk_type ?? "").toLowerCase().includes("pricing") || (r.risk_type ?? "").toLowerCase().includes("discount"));
  if (pricingRisks.length >= 2 && unapproved.length > 0) {
    suggestions.push({
      name: "Discount limit",
      description: "Limit discounts above threshold without approval.",
      rule_type: "DISCOUNT_LIMIT",
      enforcement_mode: "REQUIRE_APPROVAL",
      rule_config: { threshold: 30 },
    });
  }

  if (unapproved.length >= 5) {
    suggestions.push({
      name: "High-impact contract approval",
      description: `You have ${unapproved.length} unapproved changes. Require approval for high-value contracts.`,
      rule_type: "CONTRACT_THRESHOLD",
      enforcement_mode: "REQUIRE_APPROVAL",
      rule_config: { threshold: 1_000_000 },
    });
  }

  return NextResponse.json({ ok: true, suggestions });
}
