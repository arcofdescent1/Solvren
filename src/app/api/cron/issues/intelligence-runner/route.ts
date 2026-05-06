/**
 * Phase 3 — Full-scan intelligence scoring (~15 min cron).
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCronSecret } from "@/lib/cronAuth";
import { scoreOrgIssues } from "@/lib/issues/issueIntelligenceService";
import { logInfo } from "@/lib/observability/logger";

export async function POST(req: Request) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  const admin = createAdminClient();
  const res = await scoreOrgIssues(admin);
  logInfo("cron.issue_intelligence_runner", res);
  return NextResponse.json({ ok: true, ...res });
}
