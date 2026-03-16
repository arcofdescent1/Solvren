import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  planFromString,
  canUseSlack,
  canUseEmail,
  canUseWeeklyDigest,
} from "@/services/billing/entitlements";
import { buildWeeklyDigest } from "@/services/digests/weeklyDigest";
import { requireCronSecret } from "@/lib/cronAuth";
import { logError, logInfo } from "@/lib/observability/logger";

function isoWeekKey() {
  const d = new Date();
  const yr = d.getUTCFullYear();
  const onejan = new Date(Date.UTC(yr, 0, 1));
  const week = Math.ceil(
    ((d.getTime() - onejan.getTime()) / 86400000 + onejan.getUTCDay() + 1) / 7
  );
  return `${yr}-W${String(week).padStart(2, "0")}`;
}

export async function POST(req: Request) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  const admin = createAdminClient();

  const { data: settingsRows, error: sErr } = await admin
    .from("digest_settings")
    .select(
      "org_id, enabled, slack_enabled, email_enabled, slack_channel_id, email_recipients"
    )
    .eq("enabled", true);

  if (sErr) {
    logError("digests.weekly.settings_fetch_failed", new Error(sErr.message), {
      route: "/api/digests/weekly/run",
    });
    return NextResponse.json({ error: sErr.message }, { status: 500 });
  }

  let scanned = 0;
  let enqueued = 0;
  let errors = 0;
  const weekKey = isoWeekKey();
  const dedupeBasePrefix = (orgId: string) =>
    `weekly_digest:${orgId}:${weekKey}`;

  for (const ds of settingsRows ?? []) {
    scanned += 1;
    const orgId = String(ds.org_id);

    const { data: billing } = await admin
      .from("billing_accounts")
      .select("plan_key, status")
      .eq("org_id", orgId)
      .maybeSingle();

    const plan = planFromString(billing?.plan_key ?? "FREE");
    const status = (billing?.status ?? null) as string | null;
    if (!canUseWeeklyDigest(plan, status)) continue;

    const { data: orgSettings } = await admin
      .from("organization_settings")
      .select("notification_emails")
      .eq("org_id", orgId)
      .maybeSingle();

    let digest: Awaited<ReturnType<typeof buildWeeklyDigest>>;
    try {
      digest = await buildWeeklyDigest(admin, { orgId });
    } catch (e) {
      errors += 1;
      logError("digests.weekly.build_failed", e, {
        orgId,
      });
      continue;
    }

    const basePayload = {
      orgId,
      blocks: digest.blocks,
      emailSubject: digest.emailSubject,
      emailText: digest.emailText,
      revenueAtRisk7d: digest.revenueAtRisk7d,
      pendingCount: digest.pendingCount,
    };

    const dedupeBase = dedupeBasePrefix(orgId);

    if (Boolean(ds.slack_enabled) && canUseSlack(plan, status)) {
      const { data: install } = await admin
        .from("slack_installations")
        .select("bot_token, default_channel_id, status")
        .eq("org_id", orgId)
        .eq("status", "ACTIVE")
        .maybeSingle();

      const channelId = (ds.slack_channel_id ??
        install?.default_channel_id) as string | null;
      if (install?.bot_token && channelId) {
        const { error: oErr } = await admin
          .from("notification_outbox")
          .insert({
            org_id: orgId,
            channel: "SLACK",
            template_key: "weekly_digest",
            payload: { ...basePayload, channelId },
            status: "PENDING",
            available_at: new Date().toISOString(),
            dedupe_key: `${dedupeBase}:slack`,
          });
        if (!oErr) {
          enqueued += 1;
        } else {
          const msg = String((oErr as { message?: string })?.message ?? "");
          const code = String((oErr as { code?: string })?.code ?? "");
          if (code !== "23505" && !msg.toLowerCase().includes("duplicate")) {
            errors += 1;
            logError("digests.weekly.outbox_insert_failed_slack", new Error((oErr as { message?: string })?.message ?? "outbox insert failed"), {
              orgId,
              weekKey,
            });
          }
        }
      }
    }

    if (Boolean(ds.email_enabled) && canUseEmail(plan, status)) {
      const recipients = (ds.email_recipients ??
        orgSettings?.notification_emails ??
        []) as string[];
      if (recipients.length) {
        const { error: oErr } = await admin
          .from("notification_outbox")
          .insert({
            org_id: orgId,
            channel: "EMAIL",
            template_key: "weekly_digest",
            payload: { ...basePayload, recipients },
            status: "PENDING",
            available_at: new Date().toISOString(),
            dedupe_key: `${dedupeBase}:email`,
          });
        if (!oErr) {
          enqueued += 1;
        } else {
          const msg = String((oErr as { message?: string })?.message ?? "");
          const code = String((oErr as { code?: string })?.code ?? "");
          if (code !== "23505" && !msg.toLowerCase().includes("duplicate")) {
            errors += 1;
            logError("digests.weekly.outbox_insert_failed_email", new Error((oErr as { message?: string })?.message ?? "outbox insert failed"), {
              orgId,
              weekKey,
            });
          }
        }
      }
    }
  }

  logInfo("digests.weekly.completed", { scanned, enqueued, errors, weekKey });

  return NextResponse.json({
    ok: true,
    scanned,
    enqueued,
    errors,
    weekKey,
  });
}
