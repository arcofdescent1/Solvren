import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createPrivilegedClient } from "@/lib/server/adminClient";
import { runDataRetentionSweep } from "@/lib/server/runDataRetentionSweep";

/**
 * Phase 1 — daily retention sweep: audit_log, terminal notification_outbox rows, hard-delete old tombstones.
 * Protect with CRON_SECRET (same pattern as other cron routes).
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!env.cronSecret || secret !== env.cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createPrivilegedClient("POST /api/cron/data-retention: retention purge sweep");
  const maxOrgsRaw = req.nextUrl?.searchParams?.get("maxOrgs");
  const maxOrgs = maxOrgsRaw ? Math.min(Math.max(Number(maxOrgsRaw), 1), 10000) : undefined;

  const sweep = await runDataRetentionSweep(admin, maxOrgs != null ? { maxOrgs } : undefined);

  if (sweep.errors.length > 0) {
    return NextResponse.json({ ok: false, ...sweep }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...sweep });
}
