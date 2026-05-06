import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cronAuth";
import { runPrivacyDowngradeSweep } from "@/lib/server/privacy/process-privacy-downgrade-jobs";

/**
 * POST /api/cron/privacy/downgrade-jobs — process org_privacy_jobs queue (service role).
 */
export async function POST(req: Request) {
  const authFailure = requireCronSecret(req);
  if (authFailure) return authFailure;

  const maxRaw = new URL(req.url).searchParams.get("maxJobs");
  const maxJobs = maxRaw ? Math.min(Math.max(Number(maxRaw), 1), 100) : 10;

  const { processed, errors } = await runPrivacyDowngradeSweep(maxJobs);
  if (errors.length > 0) {
    return NextResponse.json({ ok: true, processed, errors }, { status: 207 });
  }
  return NextResponse.json({ ok: true, processed, errors });
}
