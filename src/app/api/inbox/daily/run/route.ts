import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUseSlack } from "@/lib/billing/entitlements";
import type { PlanKey } from "@/lib/billing/entitlements";
import { requireCronSecret } from "@/lib/cronAuth";
import { logError, logInfo } from "@/lib/observability/logger";

const MAX_ITEMS = 8;

function ymdUTC(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function POST(req: Request) {
  const unauthorized = requireCronSecret(req);
  if (unauthorized) return unauthorized;

  const admin = createAdminClient();
  const dateKey = ymdUTC();

  const { data: installs, error: iErr } = await admin
    .from("slack_installations")
    .select("org_id, default_channel_id, status")
    .eq("status", "ACTIVE");

  if (iErr) {
    logError("inbox.daily.slack_installations_fetch_failed", new Error(iErr.message), {
      route: "/api/inbox/daily/run",
    });
    return NextResponse.json({ error: iErr.message }, { status: 500 });
  }

  let scanned = 0;
  let enqueued = 0;
  let errors = 0;

  for (const inst of installs ?? []) {
    scanned += 1;

    const orgId = String(inst.org_id);
    const channelId = inst.default_channel_id
      ? String(inst.default_channel_id)
      : null;
    if (!channelId) continue;

    const { data: settings } = await admin
      .from("organization_settings")
      .select("slack_enabled")
      .eq("org_id", orgId)
      .maybeSingle();

    if (!settings?.slack_enabled) continue;

    const { data: billing } = await admin
      .from("billing_accounts")
      .select("plan_key, status")
      .eq("org_id", orgId)
      .maybeSingle();

    const plan_key = (billing?.plan_key ?? "FREE") as PlanKey;
    const status = (billing?.status ?? null) as string | null;

    if (!canUseSlack(plan_key, status)) continue;

    const { data: changes, error: cErr } = await admin
      .from("change_events")
      .select("id, title, due_at, sla_status, escalated_at, created_at, status")
      .eq("org_id", orgId)
      .in("status", ["SUBMITTED", "IN_REVIEW"])
      .order("created_at", { ascending: false })
      .limit(60);

    if (cErr || !changes || changes.length === 0) continue;

    const changeIds = changes.map((c) => c.id);

    const { data: approvals } = await admin
      .from("approvals")
      .select("id, change_event_id, decision")
      .in("change_event_id", changeIds)
      .eq("decision", "PENDING");

    const approvalByChange = new Map<string, string>();
    for (const a of approvals ?? []) {
      const k = String(a.change_event_id);
      if (!approvalByChange.has(k)) approvalByChange.set(k, String(a.id));
    }

    const { data: assessments } = await admin
      .from("impact_assessments")
      .select("change_event_id, risk_bucket, risk_score_raw, created_at")
      .in("change_event_id", changeIds)
      .order("created_at", { ascending: false });

    const riskByChange = new Map<
      string,
      { bucket: string | null; score: number | null }
    >();
    for (const a of assessments ?? []) {
      const id = String(a.change_event_id);
      if (!riskByChange.has(id)) {
        riskByChange.set(id, {
          bucket: a.risk_bucket ? String(a.risk_bucket) : null,
          score: a.risk_score_raw != null ? Number(a.risk_score_raw) : null,
        });
      }
    }

    const now = Date.now();

    const items = changes
      .map((c) => {
        const id = String(c.id);
        const approvalId = approvalByChange.get(id) ?? null;
        const risk = riskByChange.get(id);
        const bucket = risk?.bucket ?? null;
        const score = risk?.score ?? null;

        const dueAtMs = c.due_at ? new Date(String(c.due_at)).getTime() : null;
        const overdue = dueAtMs != null && dueAtMs < now;
        const escalated =
          Boolean(c.escalated_at) ||
          String(c.sla_status ?? "") === "ESCALATED";

        const high =
          bucket === "HIGH" ||
          bucket === "CRITICAL" ||
          (score != null && score >= 70);

        const pri =
          (bucket === "CRITICAL" ? 100 : bucket === "HIGH" ? 70 : score ?? 10) +
          (overdue ? 40 : 0) +
          (escalated ? 30 : 0) +
          (approvalId ? 20 : 0);

        return {
          changeEventId: id,
          title: String(c.title ?? id),
          riskBucket: bucket,
          dueAt: c.due_at ? String(c.due_at) : null,
          slaStatus: c.sla_status ? String(c.sla_status) : null,
          pendingApprovalId: approvalId,
          pri,
          overdue,
          escalated,
          high,
        };
      })
      .filter((x) => x.high || x.overdue || x.escalated)
      .sort((a, b) => b.pri - a.pri)
      .slice(0, MAX_ITEMS);

    if (items.length === 0) continue;

    const summary = {
      highRiskCount: items.filter((x) => x.high).length,
      overdueCount: items.filter((x) => x.overdue).length,
      escalatedCount: items.filter((x) => x.escalated).length,
    };

    const payload = {
      orgId,
      channelId,
      dateKey,
      summary,
      items: items.map((x) => ({
        changeEventId: x.changeEventId,
        title: x.title,
        riskBucket: x.riskBucket,
        dueAt: x.dueAt,
        slaStatus: x.slaStatus,
        pendingApprovalId: x.pendingApprovalId,
      })),
    };

    const dedupe_key = `daily_inbox:${orgId}:${dateKey}`;

    const { error: oErr } = await admin.from("notification_outbox").insert({
      org_id: orgId,
      channel: "SLACK",
      template_key: "daily_inbox",
      payload,
      status: "PENDING",
      available_at: new Date().toISOString(),
      dedupe_key,
    });

    if (!oErr) {
      enqueued += 1;
    } else {
      const code = String((oErr as { code?: string })?.code ?? "");
      const msg = String((oErr as { message?: string })?.message ?? "").toLowerCase();
      if (code !== "23505" && !msg.includes("duplicate")) {
        errors += 1;
        logError("inbox.daily.outbox_insert_failed", new Error((oErr as { message?: string })?.message ?? "outbox insert failed"), {
          orgId,
          dateKey,
        });
      }
    }
  }
  logInfo("inbox.daily.completed", { scanned, enqueued, errors, dateKey });

  return NextResponse.json({
    ok: true,
    scanned,
    enqueued,
    errors,
    dateKey,
  });
}
