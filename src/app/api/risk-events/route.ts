import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const orgId = url.searchParams.get("org_id") ?? url.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "org_id required" }, { status: 400 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const days = Math.min(parseInt(url.searchParams.get("days") ?? "7", 10) || 7, 90);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: events, error } = await supabase
    .from("risk_events")
    .select("*")
    .eq("org_id", orgId)
    .gte("timestamp", since.toISOString())
    .order("timestamp", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, events: events ?? [] });
}
