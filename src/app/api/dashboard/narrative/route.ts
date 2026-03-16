/**
 * GET /api/dashboard/narrative
 * Gap 1: Plain-language highest-priority issue for the Overview dashboard.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) {
    return NextResponse.json({
      headline: null,
      summary: "Connect an organization to see your highest-priority revenue issue.",
      topEventId: null,
      sourceSystem: null,
      impactAmount: null,
      suggestedAction: "Complete onboarding and connect Jira to detect revenue-impacting changes.",
    });
  }

  const since = new Date();
  since.setDate(since.getDate() - 7);

  const { data: events } = await supabase
    .from("risk_events")
    .select("id, provider, object, risk_type, impact_amount, risk_score, approved_at, change_event_id")
    .eq("org_id", activeOrgId)
    .gte("timestamp", since.toISOString())
    .order("risk_score", { ascending: false })
    .order("timestamp", { ascending: false })
    .limit(1);

  const top = events?.[0];
  if (!top) {
    return NextResponse.json({
      headline: null,
      summary: "No revenue risks detected in the last 7 days. When monitoring is active, your highest-priority issue will appear here.",
      topEventId: null,
      sourceSystem: null,
      impactAmount: null,
      suggestedAction: "Connect Jira to begin detecting revenue-impacting changes.",
    });
  }

  const impact = Number(top.impact_amount);
  const impactStr = Number.isFinite(impact)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(impact)
    : null;
  const riskType = (top.risk_type ?? "").replace(/_/g, " ");
  const sourceSystem = top.provider ?? "Unknown";
  const headline = `Unapproved ${riskType} from ${sourceSystem}${top.object ? ` (${top.object})` : ""}`;
  let summary: string;
  let suggestedAction: string;
  if (top.change_event_id) {
    summary = impactStr
      ? `An unapproved revenue-related change linked to ${sourceSystem} with an estimated impact of ${impactStr}.`
      : `An unapproved revenue-related change linked to ${sourceSystem}.`;
    suggestedAction = "Review and approve the linked change, or investigate the risk.";
  } else {
    summary = impactStr
      ? `Revenue risk detected from ${sourceSystem} with an estimated impact of ${impactStr}. No change has been linked yet.`
      : `Revenue risk detected from ${sourceSystem}. No change has been linked yet.`;
    suggestedAction = "Link to a governed change or create a new change to track approval.";
  }

  return NextResponse.json({
    headline,
    summary,
    topEventId: top.id,
    sourceSystem,
    impactAmount: Number.isFinite(impact) ? impact : null,
    suggestedAction,
  });
}
