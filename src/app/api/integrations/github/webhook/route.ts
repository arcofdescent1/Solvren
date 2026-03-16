/**
 * POST /api/integrations/github/webhook
 * GitHub App webhook receiver. Validates signature, enqueues event, returns 200.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import * as crypto from "crypto";

export const dynamic = "force-dynamic";

function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  const secret = env.githubWebhookSecret;
  if (!secret || !signature || !signature.startsWith("sha256=")) return false;
  const expected = signature.slice(7);
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const actual = hmac.digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!env.githubEnabled) {
    return NextResponse.json({ error: "GitHub integration not configured" }, { status: 503 });
  }

  const signature = req.headers.get("X-Hub-Signature-256");
  const event = req.headers.get("X-GitHub-Event");
  const delivery = req.headers.get("X-GitHub-Delivery");

  if (!event || !delivery) {
    return NextResponse.json({ error: "Missing X-GitHub-Event or X-GitHub-Delivery" }, { status: 400 });
  }

  const rawBody = await req.text();
  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const p = payload as Record<string, unknown>;
  const installation = p.installation as { id?: number } | undefined;
  const repo = p.repository as { id?: number } | undefined;

  const admin = createAdminClient();
  let orgId: string | null = null;
  if (installation?.id) {
    const { data: inst } = await admin
      .from("github_installations")
      .select("org_id")
      .eq("github_installation_id", installation.id)
      .maybeSingle();
    orgId = (inst as { org_id?: string })?.org_id ?? null;
  }

  const { error: dup } = await admin.from("github_webhook_events").insert({
    org_id: orgId,
    github_delivery_id: delivery,
    github_event: event,
    github_installation_id: installation?.id ?? null,
    github_repository_id: repo?.id ?? null,
    action: (p.action as string) ?? null,
    payload: p as Record<string, unknown>,
  });

  if (dup) {
    if (dup.code === "23505") {
      return new NextResponse(null, { status: 200 });
    }
    return NextResponse.json({ error: "Failed to enqueue" }, { status: 500 });
  }

  return new NextResponse(null, { status: 200 });
}
