/**
 * Phase 4 — Scheduled detector runner cron (§18).
 * POST /api/cron/detectors/run-scheduled
 * Auth: CRON_SECRET via Authorization: Bearer or x-cron-secret
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/cronAuth";
import { runScheduledDetectors } from "@/modules/detection/jobs/run-scheduled-detectors.job";

export async function POST(req: Request) {
  const authFailure = requireCronSecret(req);
  if (authFailure) return authFailure;

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Admin client not configured (SUPABASE_SERVICE_ROLE_KEY)" },
      { status: 500 }
    );
  }

  try {
    const { runs, errors } = await runScheduledDetectors(supabase);
    return NextResponse.json({ ok: true, runs, errors });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Scheduled detectors failed" },
      { status: 500 }
    );
  }
}
