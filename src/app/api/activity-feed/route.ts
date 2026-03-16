/**
 * Revenue Risk Activity Feed
 * Aggregates timeline events, risk detections, and notifications into a live activity stream.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const orgId = url.searchParams.get("orgId");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 50);

  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const since = new Date();
  since.setDate(since.getDate() - 7);

  type FeedItem = {
    timestamp: string;
    event_type: string;
    system: string;
    description: string;
    severity: "info" | "warning" | "high" | "success";
  };

  const items: FeedItem[] = [];

  // Risk events
  const { data: riskRows } = await supabase
    .from("risk_events")
    .select("id, provider, object, risk_type, risk_bucket, risk_score, impact_amount, timestamp")
    .eq("org_id", orgId)
    .gte("timestamp", since.toISOString())
    .order("timestamp", { ascending: false })
    .limit(limit);

  for (const r of riskRows ?? []) {
    const bucket = (r.risk_bucket ?? "").toUpperCase();
    items.push({
      timestamp: r.timestamp,
      event_type: "risk_detected",
      system: r.provider,
      description: `Solvren detected ${(r.risk_type ?? "").replace(/_/g, " ")} from ${r.provider}${r.object ? ` (${r.object})` : ""}`,
      severity: bucket === "CRITICAL" || bucket === "HIGH" ? "high" : bucket === "MODERATE" ? "warning" : "info",
    });
  }

  // Change timeline events
  const { data: timelineRows } = await supabase
    .from("change_timeline_events")
    .select("id, title, event_type, created_at")
    .eq("org_id", orgId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(limit);

  for (const t of timelineRows ?? []) {
    const eventType = (t.event_type ?? "").toUpperCase();
    items.push({
      timestamp: t.created_at,
      event_type: "timeline",
      system: "Solvren",
      description: t.title ?? eventType ?? "Change updated",
      severity: eventType === "APPROVED" ? "success" : "info",
    });
  }

  // Merge and sort by timestamp desc
  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const feed = items.slice(0, limit);

  return NextResponse.json({ ok: true, feed });
}
