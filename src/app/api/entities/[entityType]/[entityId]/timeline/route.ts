/**
 * Phase 7 — GET /api/entities/:entityType/:entityId/timeline (§18.2).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEntityTimeline } from "@/modules/timeline/services/revenue-timeline.service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ entityType: string; entityId: string }> }
) {
  const { entityType, entityId } = await params;
  if (!entityType || !entityId) {
    return NextResponse.json(
      { error: "entityType and entityId required" },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(_req.url ?? "", "http://localhost");
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "100", 10) || 100);

  const { events, error } = await getEntityTimeline(
    supabase,
    entityType,
    entityId,
    { limit }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    entityType,
    entityId,
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
      issueId: e.issueId,
    })),
  });
}
