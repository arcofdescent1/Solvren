/**
 * Phase 4 — Verification runner (~15 min cron): resolved + pending + 3 calendar days elapsed.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/cronAuth";
import { runVerificationForEligibleIssues } from "@/lib/issues/verification/runIssueVerification";
import { logInfo } from "@/lib/observability/logger";

export async function POST(req: Request) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  const admin = createAdminClient();
  const res = await runVerificationForEligibleIssues(admin);
  logInfo("cron.issue_verification_runner", res);
  return NextResponse.json({ ok: true, ...res });
}
