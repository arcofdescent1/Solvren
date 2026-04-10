import type { SupabaseClient } from "@supabase/supabase-js";
import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { parseOrgRole } from "@/lib/rbac/roles";
import { ORG_ATTENTION_SETTINGS_SELECT, resolveOrgAttentionSettings } from "./orgAttentionDefaults";
import { buildAttentionContext } from "./buildAttentionContext";
import { routeAttention } from "./routeAttention";
import { getRoutingPersona } from "./getRoutingPersona";

/**
 * Phase 2 — enqueue Slack DM digest rows (template attention_digest_dm). Idempotent per org/user/period/day.
 */
export async function enqueueAttentionDigests(
  admin: SupabaseClient,
  period: "DAILY" | "WEEKLY"
): Promise<{ scannedOrgs: number; enqueued: number }> {
  let scannedOrgs = 0;
  let enqueued = 0;

  const { data: installs, error: iErr } = await admin
    .from("slack_installations")
    .select("org_id")
    .eq("status", "ACTIVE");
  if (iErr) throw new Error(iErr.message);

  const periodKey = period === "DAILY" ? "daily" : "weekly";
  const dayKey = new Date().toISOString().slice(0, 10);

  for (const inst of installs ?? []) {
    const orgId = String((inst as { org_id: string }).org_id);
    scannedOrgs += 1;

    const { data: digest } = await admin.from("digest_settings").select("enabled").eq("org_id", orgId).maybeSingle();
    if (!digest?.enabled) continue;

    const { data: st } = await admin
      .from("organization_settings")
      .select(`${ORG_ATTENTION_SETTINGS_SELECT}, slack_enabled`)
      .eq("org_id", orgId)
      .maybeSingle();
    if (!st?.slack_enabled) continue;

    const ar = resolveOrgAttentionSettings(st as Record<string, unknown>);
    if (period === "DAILY" && !ar.attentionDailyDigestEnabled) continue;
    if (period === "WEEKLY" && !ar.attentionWeeklyDigestEnabled) continue;

    const { data: memberRows } = await admin
      .from("organization_members")
      .select("user_id, role")
      .eq("org_id", orgId)
      .limit(400);
    const { data: roleRows } = await admin
      .from("organization_member_roles")
      .select("user_id, role_key")
      .eq("org_id", orgId);

    const keysByUser = new Map<string, string[]>();
    for (const r of roleRows ?? []) {
      const uid = String((r as { user_id: string }).user_id);
      const key = String((r as { role_key?: string }).role_key ?? "").toUpperCase();
      if (!key) continue;
      const cur = keysByUser.get(uid) ?? [];
      cur.push(key);
      keysByUser.set(uid, cur);
    }

    const digestUserIds = new Set<string>();
    for (const row of memberRows ?? []) {
      const userId = String((row as { user_id: string }).user_id);
      const persona = getRoutingPersona({
        orgRole: parseOrgRole((row as { role?: string | null }).role ?? null),
        roleKeysUpper: keysByUser.get(userId) ?? [],
      });
      if (persona === "EXECUTIVE" || persona === "SENIOR_TECH_LEADER") {
        digestUserIds.add(userId);
      }
    }

    if (digestUserIds.size === 0) continue;

    const { data: changes } = await scopeActiveChangeEvents(
      admin.from("change_events").select("id, title")
    )
      .eq("org_id", orgId)
      .in("status", ["IN_REVIEW", "SUBMITTED"])
      .order("created_at", { ascending: false })
      .limit(20);

    const lines: string[] = [];
    for (const c of changes ?? []) {
      const cid = String((c as { id: string }).id);
      const ctx = await buildAttentionContext(admin, cid);
      if (!ctx) continue;
      const routes = routeAttention({ eventType: "CHANGE_UPDATED", context: ctx });
      const digestish = routes.filter(
        (r) => r.routeType === "DAILY_DIGEST" || r.routeType === "WEEKLY_DIGEST"
      );
      if (digestish.length === 0) continue;
      const title = String((c as { title?: string }).title ?? cid).slice(0, 80);
      lines.push(`• *${title}* — ${ctx.view.riskLevel} / ${ctx.view.recommendation}`);
    }

    if (lines.length === 0) continue;

    const text =
      `*Solvren ${periodKey} attention digest*\n` +
      lines.slice(0, 10).join("\n") +
      (lines.length > 10 ? `\n_+${lines.length - 10} more…_` : "");

    for (const userId of digestUserIds) {
      const { data: map } = await admin
        .from("slack_user_map")
        .select("slack_user_id")
        .eq("org_id", orgId)
        .eq("user_id", userId)
        .maybeSingle();
      const slackUserId = (map as { slack_user_id?: string } | null)?.slack_user_id;
      if (!slackUserId) continue;

      const dedupe_key = `attention_digest_dm:${periodKey}:${orgId}:${userId}:${dayKey}`;
      const { data: dupe } = await admin
        .from("notification_outbox")
        .select("id")
        .eq("dedupe_key", dedupe_key)
        .maybeSingle();
      if (dupe) continue;

      const { error } = await admin.from("notification_outbox").insert({
        org_id: orgId,
        change_event_id: null,
        channel: "SLACK",
        template_key: "attention_digest_dm",
        payload: { slackUserId, text, orgId, period: periodKey },
        status: "PENDING",
        attempt_count: 0,
        last_error: null,
        available_at: new Date().toISOString(),
        dedupe_key,
      });
      if (!error) enqueued += 1;
    }
  }

  return { scannedOrgs, enqueued };
}
