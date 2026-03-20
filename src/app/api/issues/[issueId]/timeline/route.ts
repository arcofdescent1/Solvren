/**
 * Phase 7 — GET /api/issues/:issueId/timeline (§18.1).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getIssueTimeline } from "@/modules/timeline/services/revenue-timeline.service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const { issueId } = await params;
  if (!issueId) {
    return NextResponse.json({ error: "issueId required" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(_req.url ?? "", "http://localhost");
  const limit = Math.min(200, parseInt(searchParams.get("limit") ?? "200", 10) || 200);

  const { events, error } = await getIssueTimeline(supabase, issueId, { limit });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    issueId,
    events: events.map((e) => ({
      eventId: e.eventId,
      eventType: e.eventType,
      category: e.category,
      headline: e.headline,
      summary: e.summary,
      amount: e.amount,
      valueType: e.valueType,
      eventTime: e.eventTime,
      status: e.status,
    })),
  });
}
