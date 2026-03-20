/**
 * Phase 6 — Cron: build benchmark snapshots (§17.1).
 */
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runBuildBenchmarkSnapshots } from "@/modules/benchmarking/jobs/build-benchmark-snapshots.job";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = env.cronSecret;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runBuildBenchmarkSnapshots();
  return NextResponse.json(result);
}
