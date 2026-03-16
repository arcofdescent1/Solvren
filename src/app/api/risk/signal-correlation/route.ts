import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const domain = url.searchParams.get("domain") ?? "REVENUE";
  const windowDays = url.searchParams.get("windowDays") ?? null;

  const { data: orgRow } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  const orgId = orgRow?.org_id as string;
  if (!orgId)
    return NextResponse.json({ error: "No org" }, { status: 400 });

  const { data, error } = await supabase
    .from("signal_stats")
    .select(
      "signal_key,total_changes,incident_changes,total_revenue_at_risk,incident_revenue_at_risk,incident_realized_mrr,incident_realized_revenue,incident_rate,revenue_incident_rate,mitigation_effectiveness,mitigations_applied_count,mitigations_total_suggested,learned_multiplier,learned_multiplier_reason,bayes_mean,bayes_ci_low,bayes_ci_high,bayes_confidence,mitigation_lift,mitigation_ci_low,mitigation_ci_high,model_version,updated_at"
    )
    .eq("org_id", orgId)
    .eq("domain", domain)
    .eq("model_version", 1)
    .order("incident_revenue_at_risk", { ascending: false })
    .limit(50);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    rows: data ?? [],
    windowDays: windowDays ?? undefined,
  });
}
