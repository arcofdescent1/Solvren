import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

/**
 * Admin/ops-only trigger for the SLA tick job. Calls the job endpoint with CRON_SECRET
 * so "Run now" in the UI works without exposing the secret to the client.
 */
export async function POST() {
  try {
    await requireAnyOrgPermission("admin.jobs.view");

    const cronSecret = env.cronSecret;
    if (!cronSecret)
      return NextResponse.json(
        { error: "CRON_SECRET not configured; cannot trigger job" },
        { status: 503 }
      );

    const base = env.appUrl.replace(/\/$/, "");
    const url = `${base}/api/sla/tick`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        "Content-Type": "application/json",
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok)
      return NextResponse.json(
        { error: (json as { error?: string })?.error ?? "Job failed" },
        { status: res.status }
      );
    return NextResponse.json(json);
  } catch (e) {
    return authzErrorResponse(e);
  }
}
