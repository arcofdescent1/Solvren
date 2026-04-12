/**
 * Nightly: recompute Phase 3 milestone caches + enqueue due executive summary digests.
 * POST /api/cron/onboarding/phase3-nightly
 * Authorization: Bearer CRON_SECRET or x-cron-secret (see requireCronSecret).
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/cronAuth";
import { runPhase3Sync } from "@/modules/onboarding/phase3/phase3-sync.service";
import { runPhase4Sync } from "@/modules/onboarding/phase4/phase4-sync.service";
import { enqueueExecutiveSummaryDigestsForDueOrgs } from "@/modules/onboarding/phase3/enqueue-executive-summary-digests";
import { logError, logInfo } from "@/lib/observability/logger";

export const runtime = "nodejs";

const BATCH = 400;

export async function POST(req: Request) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  const admin = createAdminClient();
  let syncTried = 0;
  let syncErrors = 0;

  const { data: rows, error } = await admin
    .from("org_onboarding_states")
    .select("org_id, phase2_status, phase3_status")
    .eq("phase2_status", "COMPLETED")
    .limit(BATCH * 2);

  if (error) {
    logError("cron.phase3_nightly.org_list_failed", new Error(error.message), {});
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const toSync = (rows ?? []).filter((r) => {
    const s = (r as { phase3_status?: string | null }).phase3_status;
    return s !== "COMPLETED" && s !== "SKIPPED";
  }).slice(0, BATCH);

  for (const r of toSync) {
    const orgId = String((r as { org_id: string }).org_id);
    syncTried += 1;
    const { error: e2 } = await runPhase3Sync(orgId);
    if (e2) syncErrors += 1;
  }

  let phase4Tried = 0;
  let phase4Errors = 0;
  const toPhase4 = (rows ?? [])
    .filter((r) => {
      const p3 = (r as { phase3_status?: string | null }).phase3_status;
      const p4 = (r as { phase4_status?: string | null }).phase4_status;
      return p3 === "COMPLETED" && p4 !== "COMPLETED" && p4 !== "SKIPPED";
    })
    .slice(0, BATCH);
  for (const r of toPhase4) {
    const orgId = String((r as { org_id: string }).org_id);
    phase4Tried += 1;
    const { error: e4 } = await runPhase4Sync(orgId);
    if (e4) phase4Errors += 1;
  }

  let digest = { scanned: 0, enqueued: 0, errors: 0 };
  try {
    digest = await enqueueExecutiveSummaryDigestsForDueOrgs(admin);
  } catch (e) {
    logError("cron.phase3_nightly.digest_enqueue_failed", e instanceof Error ? e : new Error(String(e)), {});
    digest = { scanned: 0, enqueued: 0, errors: 1 };
  }

  logInfo("cron.phase3_nightly.completed", {
    syncTried,
    syncErrors,
    phase4Tried,
    phase4Errors,
    digestScanned: digest.scanned,
    digestEnqueued: digest.enqueued,
    digestErrors: digest.errors,
  });

  return NextResponse.json({
    ok: true,
    syncTried,
    syncErrors,
    phase4Tried,
    phase4Errors,
    executiveSummary: digest,
  });
}
