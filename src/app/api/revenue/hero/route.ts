/**
 * Phase 7 — GET /api/revenue/hero (§18.4).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getTimelineAggregates } from "@/modules/timeline/services/timeline-aggregate.service";
import { getRevenueFeed } from "@/modules/timeline/services/revenue-timeline.service";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url ?? "", "http://localhost");
  const orgId = searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const window = (searchParams.get("window") ?? "30d") as string;

  const aggWindow =
    window === "7d"
      ? ("TRAILING_30" as const)
      : window === "90d"
        ? ("TRAILING_30" as const)
        : ("TRAILING_30" as const);

  const { recoveredAmount, avoidedAmount, savingsAmount, lossAmount, error } =
    await getTimelineAggregates(supabase, orgId, aggWindow);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const windowDays = window === "7d" ? 7 : window === "90d" ? 90 : 30;
  const { events } = await getRevenueFeed(supabase, orgId, {
    limit: 10,
    minDisplayPriority: 50,
    windowDays,
  });

  const { count } = await supabase
    .from("issues")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("status", ["open", "triaged", "assigned", "in_progress"])
    .in("severity", ["high", "critical"]);

  const activeHighValueIssueCount = count ?? 0;

  return NextResponse.json({
    window: window ?? "30d",
    recoveredAmount,
    avoidedAmount,
    operationalSavingsAmount: savingsAmount,
    realizedLossAmount: lossAmount,
    activeHighValueIssueCount,
    recentEvents: events.slice(0, 10).map((e) => ({
      eventId: e.eventId,
      headline: e.headline,
      amount: e.amount,
      valueType: e.valueType,
      eventTime: e.eventTime,
      issueId: e.issueId,
    })),
  });
}
