/**
 * Phase 3 — GET /api/admin/policy-decision-logs (recent decisions).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listDecisionLogs } from "@/modules/policy/repositories/policy-decision-logs.repository";

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

  const orgId = (membership as { org_id: string }).org_id;
  const { searchParams } = new URL(req.url);
  const issueId = searchParams.get("issueId") ?? undefined;
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  const { data, error } = await listDecisionLogs(supabase, orgId, { issueId, limit });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ decisionLogs: data ?? [] });
}
