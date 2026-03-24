/**
 * Phase 4 — Heartbeat / stale detection cron (§8.2).
 * Marks integrations degraded when no inbound events in expected window.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { getAccountsByOrg } from "@/modules/integrations/core/integrationAccountsRepo";
import { getHeartbeatConfig } from "@/modules/integrations/reliability/config/providerHeartbeatDefaults";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (env.cronSecret && authHeader !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: orgs } = await admin.from("organizations").select("id").limit(100);
  let degraded = 0;

  for (const org of orgs ?? []) {
    const orgId = (org as { id: string }).id;
    const { data: accounts } = await getAccountsByOrg(admin, orgId);
    for (const account of accounts ?? []) {
      if (account.status === "disconnected") continue;
      const config = getHeartbeatConfig(account.provider);
      if (!config.enabled) continue;

      const staleMs = config.staleAfterMinutes * 60 * 1000;
      const cutoff = new Date(Date.now() - staleMs).toISOString();

      const { data: last } = await admin
        .from("integration_inbound_events")
        .select("id")
        .eq("integration_account_id", account.id)
        .gte("received_at", cutoff)
        .order("received_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!last) {
        await admin
          .from("connector_health_snapshots")
          .insert({
            org_id: orgId,
            integration_account_id: account.id,
            provider: account.provider,
            health_state: "degraded",
            metrics_json: { last_inbound_event: null },
            reasons_json: ["NO_EVENTS_IN_EXPECTED_WINDOW"],
            snapshot_time: new Date().toISOString(),
          });
        degraded++;
      }
    }
  }

  return NextResponse.json({ ok: true, degraded });
}
