/**
 * Phase 7 — Cron: refresh timeline aggregates (§17.3).
 */
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshTimelineAggregates } from "@/modules/timeline/services/timeline-aggregate.service";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = env.cronSecret;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: orgs } = await admin.from("organizations").select("id");
  const orgIds = (orgs ?? []).map((o) => (o as { id: string }).id);

  const errors: string[] = [];
  for (const orgId of orgIds) {
    const { error } = await refreshTimelineAggregates(orgId, "TRAILING_30");
    if (error) errors.push(`${orgId}: ${error.message}`);
  }

  return NextResponse.json({
    ok: errors.length === 0,
    orgsProcessed: orgIds.length,
    errors,
  });
}
