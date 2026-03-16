/**
 * POST /api/integrations/github/process
 * Process unprocessed GitHub webhook events. Call from cron or manually.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processWebhookEvent } from "@/services/github/GitHubWebhookProcessor";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!env.githubEnabled) {
    return NextResponse.json({ error: "GitHub integration not configured" }, { status: 503 });
  }

  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: events } = await admin
    .from("github_webhook_events")
    .select("id, org_id, github_delivery_id, github_event, github_installation_id, github_repository_id, payload")
    .eq("processed", false)
    .is("error_message", null)
    .limit(50)
    .order("received_at", { ascending: true });

  let processed = 0;
  for (const ev of events ?? []) {
    const result = await processWebhookEvent(admin, ev as Parameters<typeof processWebhookEvent>[1]);
    await admin
      .from("github_webhook_events")
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        error_message: result.error ?? null,
      })
      .eq("id", (ev as { id: string }).id);
    processed++;
  }

  return NextResponse.json({ processed });
}
