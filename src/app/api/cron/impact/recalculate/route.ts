/**
 * Phase 5 — Process impact recalculation queue.
 * POST /api/cron/impact/recalculate
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/cronAuth";
import { processRecalculationQueue } from "@/modules/impact/jobs/process-recalculation-queue.job";

export async function POST(req: Request) {
  const authFailure = requireCronSecret(req);
  if (authFailure) return authFailure;

  try {
    const supabase = createAdminClient();
    const { processed, succeeded, failed } = await processRecalculationQueue(supabase);
    return NextResponse.json({ ok: true, processed, succeeded, failed });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Recalculation failed" },
      { status: 500 }
    );
  }
}
