/**
 * Phase 7 — GET /api/outcomes/list.
 * List outcomes for org (with optional issue filter).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listOutcomesForOrg } from "@/modules/outcomes";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership?.org_id) return NextResponse.json({ error: "No org" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 200);

  let sinceIso: string | undefined;
  if (since) {
    const days = parseInt(since, 10) || 30;
    const d = new Date();
    d.setDate(d.getDate() - days);
    sinceIso = d.toISOString();
  }

  const { data: outcomes, error } = await listOutcomesForOrg(supabase, membership.org_id, {
    since: sinceIso,
    limit,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ outcomes });
}
