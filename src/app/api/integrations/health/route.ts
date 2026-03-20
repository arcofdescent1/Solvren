/**
 * Gap 4 — GET /api/integrations/health (§14.3).
 * Integration health dashboard data.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: health, error } = await supabase
    .from("integration_health")
    .select("*")
    .eq("org_id", orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    integrations: (health ?? []).map((h) => ({
      provider: h.provider,
      status: h.status,
      lastSuccess: h.last_success ?? undefined,
      lastFailure: h.last_failure ?? undefined,
      errorRate: h.error_rate ?? 0,
      avgLatencyMs: h.avg_latency_ms ?? undefined,
      updatedAt: h.updated_at,
    })),
  });
}
