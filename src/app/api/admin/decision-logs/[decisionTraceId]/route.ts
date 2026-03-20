/**
 * Phase 5 — GET /api/admin/decision-logs/:decisionTraceId (§22.2).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDecisionLog } from "@/modules/decision/services/decision-engine.service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ decisionTraceId: string }> }
) {
  const { decisionTraceId } = await params;
  if (!decisionTraceId) {
    return NextResponse.json({ error: "decisionTraceId required" }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await getDecisionLog(supabase, decisionTraceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Decision log not found" }, { status: 404 });
  return NextResponse.json(data);
}
