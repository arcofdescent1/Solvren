/**
 * Phase 4 — GET /api/admin/integrations/:integrationId/health (§18.1).
 */
import { NextRequest, NextResponse } from "next/server";
import { getAccountById } from "@/modules/integrations/core/integrationAccountsRepo";
import { getLatestConnectorHealth } from "@/modules/integrations/reliability/repositories/connector-health-snapshots.repository";
import { authzErrorResponse, resolveResourceInOrg } from "@/lib/server/authz";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    const { integrationId } = await params;

    const ctx = await resolveResourceInOrg({
      table: "integration_accounts",
      resourceId: integrationId,
      permission: "integrations.view",
    });

    const { data: account } = await getAccountById(ctx.supabase, integrationId);
    if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: snapshot } = await getLatestConnectorHealth(ctx.supabase, integrationId);
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
  } catch (e) {
    return authzErrorResponse(e);
  }
}
