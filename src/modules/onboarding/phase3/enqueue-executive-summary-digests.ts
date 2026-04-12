/**
 * Enqueue weekly executive summary notifications from org_executive_summary_preferences.
 * Intended to be called by nightly cron (one row per org per ISO week per channel).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

function isoWeekKeyUtc(d = new Date()): string {
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  const thursday = new Date(target);
  thursday.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / 604800000);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function weekdayLongInTimeZone(timeZone: string, d = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" }).formatToParts(d);
  const w = parts.find((p) => p.type === "weekday")?.value ?? "";
  return w.toLowerCase();
}

async function buildSummaryLines(admin: SupabaseClient, orgId: string, metricKeys: string[]): Promise<string[]> {
  const lines: string[] = [];
  const want = new Set(metricKeys);

  if (want.has("revenue_at_risk")) {
    const { count } = await admin
      .from("issues")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .in("status", ["open", "triaged", "assigned", "in_progress"]);
    lines.push(`Active issues (proxy for revenue exposure): ${count ?? 0}`);
  }
  if (want.has("prevented_incidents")) {
    const { count } = await admin
      .from("issues")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .in("status", ["resolved", "verified"]);
    lines.push(`Issues resolved/verified (lifetime): ${count ?? 0}`);
  }
  if (want.has("approval_bottlenecks")) {
    const { count } = await admin
      .from("approvals")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("decision", "PENDING");
    lines.push(`Pending approvals: ${count ?? 0}`);
  }
  if (want.has("forecast_changes") || want.has("value_created") || want.has("time_saved")) {
    lines.push("Forecast, value-created, and time-saved rollups: see ROI and value stories in Solvren.");
  }

  if (lines.length === 0) {
    lines.push("Open your executive overview for the latest risk and governance posture.");
  }
  return lines;
}

export async function enqueueExecutiveSummaryDigestsForDueOrgs(
  admin: SupabaseClient
): Promise<{ scanned: number; enqueued: number; errors: number }> {
  const weekKey = isoWeekKeyUtc();
  let scanned = 0;
  let enqueued = 0;
  let errors = 0;

  const { data: prefs } = await admin.from("org_executive_summary_preferences").select("*").eq("enabled", true);

  for (const raw of prefs ?? []) {
    scanned += 1;
    const p = raw as {
      org_id: string;
      delivery_channel: string;
      destination: string;
      schedule_day: string;
      timezone: string;
      metrics: unknown;
    };
    const orgId = String(p.org_id);
    const tz = (p.timezone && String(p.timezone).trim()) || "UTC";
    const scheduleDay = String(p.schedule_day ?? "").trim().toLowerCase();
    if (!scheduleDay) continue;

    const todayWd = weekdayLongInTimeZone(tz);
    if (todayWd !== scheduleDay) continue;

    const metricsArr = Array.isArray(p.metrics) ? (p.metrics as string[]) : [];
    const lines = await buildSummaryLines(admin, orgId, metricsArr);
    const body = lines.join("\n");
    const title = "Weekly executive summary";

    const channel = String(p.delivery_channel ?? "").toLowerCase();
    const dest = String(p.destination ?? "").trim();
    if (!dest) {
      errors += 1;
      continue;
    }

    const dedupe = `executive_summary:${orgId}:${weekKey}:${channel}`;

    if (channel === "email") {
      if (!dest.includes("@")) {
        errors += 1;
        continue;
      }
      const payload = {
        title,
        body,
        metrics: metricsArr,
        recipients: [dest],
      };
      const { error } = await admin.from("notification_outbox").insert({
        org_id: orgId,
        channel: "EMAIL",
        template_key: "executive_summary",
        payload,
        status: "PENDING",
        available_at: new Date().toISOString(),
        dedupe_key: dedupe,
      });
      if (error) {
        const msg = String(error.message ?? "").toLowerCase();
        if (!msg.includes("duplicate") && String((error as { code?: string }).code) !== "23505") errors += 1;
      } else enqueued += 1;
      continue;
    }

    if (channel === "slack") {
      const channelId = /^[CD][A-Z0-9]+$/i.test(dest) ? dest : null;
      const payload = {
        title,
        body,
        metrics: metricsArr,
        channelId,
      };
      const { error } = await admin.from("notification_outbox").insert({
        org_id: orgId,
        channel: "SLACK",
        template_key: "executive_summary",
        payload,
        status: "PENDING",
        available_at: new Date().toISOString(),
        dedupe_key: dedupe,
      });
      if (error) {
        const msg = String(error.message ?? "").toLowerCase();
        if (!msg.includes("duplicate") && String((error as { code?: string }).code) !== "23505") errors += 1;
      } else enqueued += 1;
      continue;
    }
  }

  return { scanned, enqueued, errors };
}
