/**
 * Phase 4 — Process integration_inbound_events → raw_events (cron).
 * Run every 1–2 minutes.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { processInboundBatch } from "@/modules/integrations/reliability/services/inbound-processor.service";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (env.cronSecret && authHeader !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { processed, failed, deadLettered } = await processInboundBatch(admin, 100);

  return NextResponse.json({ ok: true, processed, failed, deadLettered });
}
