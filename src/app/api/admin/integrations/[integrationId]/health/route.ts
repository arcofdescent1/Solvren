/**
 * Phase 4 — GET /api/admin/integrations/:integrationId/health (§18.1).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAccountById } from "@/modules/integrations/core/integrationAccountsRepo";
import { getLatestConnectorHealth } from "@/modules/integrations/reliability/repositories/connector-health-snapshots.repository";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  const { integrationId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: account } = await getAccountById(supabase, integrationId);
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .eq("org_id", account.org_id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: snapshot } = await getLatestConnectorHealth(supabase, integrationId);
  const metrics = (snapshot?.metrics_json ?? {}) as Record<string, unknown>;

  return NextResponse.json({
    integrationId,
    provider: account.provider,
    healthState: snapshot?.health_state ?? "HEALTHY",
    metrics: {
      inboundSuccessRate: (metrics.inboundSuccessRate as number) ?? 1,
      outboundSuccessRate: (metrics.outboundSuccessRate as number) ?? 1,
      reconciliationSuccessRate: (metrics.reconciliationSuccessRate as number) ?? 1,
      deadLetterCount: (metrics.deadLetterCount as number) ?? 0,
      averageLatencyMs: (metrics.averageLatencyMs as number) ?? 0,
    },
    reasons: (snapshot?.reasons_json ?? []) as string[],
    lastSuccessAt: account.last_success_at,
    lastErrorAt: account.last_error_at,
  });
}
