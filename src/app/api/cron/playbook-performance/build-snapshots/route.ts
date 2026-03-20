/**
 * Phase 10 — Cron: build playbook performance snapshots (§14, §15).
 */
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runBuildPlaybookPerformanceSnapshots } from "@/modules/onboarding/jobs/build-playbook-performance-snapshots.job";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = env.cronSecret;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runBuildPlaybookPerformanceSnapshots();
  return NextResponse.json(result);
}
