/**
 * Phase 7 — GET /api/revenue/feed (§18.3).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
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

  const windowDays = Math.min(
    90,
    parseInt(searchParams.get("window") ?? "30", 10) || 30
  );
  const minDisplayPriority = parseInt(
    searchParams.get("minDisplayPriority") ?? "25",
    10
  );
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10) || 50);

  const { events, error } = await getRevenueFeed(supabase, orgId, {
    limit,
    minDisplayPriority: Number.isNaN(minDisplayPriority) ? 25 : minDisplayPriority,
    windowDays,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    events: events.map((e) => ({
      eventId: e.eventId,
      eventType: e.eventType,
      category: e.category,
      headline: e.headline,
      summary: e.summary,
      amount: e.amount,
      currencyCode: e.currencyCode,
      valueType: e.valueType,
      eventTime: e.eventTime,
      status: e.status,
      issueId: e.issueId,
      displayPriority: e.displayPriority,
    })),
  });
}
