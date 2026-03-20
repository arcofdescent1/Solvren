/**
 * Phase 4 — Refresh connector health (cron job, §17.3).
 * Run every 5 minutes.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { getAccountsByOrg } from "@/modules/integrations/core/integrationAccountsRepo";
import { refreshConnectorHealth } from "@/modules/integrations/reliability/services/connector-health.service";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (env.cronSecret && authHeader !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServerSupabaseClient();

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id")
    .limit(100);

  let refreshed = 0;
  for (const org of orgs ?? []) {
    const orgId = (org as { id: string }).id;
    const { data: accounts } = await getAccountsByOrg(supabase, orgId);
    for (const account of accounts ?? []) {
      if (account.status === "disconnected") continue;
      await refreshConnectorHealth(supabase, {
        orgId: account.org_id,
        integrationAccountId: account.id,
        provider: account.provider,
        metrics: {
          inboundSuccessRate: 1,
          outboundSuccessRate: 1,
          reconciliationSuccessRate: 1,
          deadLetterCount: 0,
          averageLatencyMs: 0,
        },
        lastSuccessAt: account.last_success_at,
        lastErrorAt: account.last_error_at,
      });
      refreshed++;
    }
  }

  return NextResponse.json({ ok: true, refreshed });
}
