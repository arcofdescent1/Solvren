import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

// --- Legacy POST body (OrgSettingsForm)
type SaveBody = {
  orgId: string;
  slack_enabled?: boolean;
  slack_webhook_url?: string | null;
  email_enabled?: boolean;
  notification_emails?: string[] | null;
};

// --- Consolidated payload (Task 10)
export type OrgSettingsPayload = {
  organization: {
    name: string;
    timezone: string;
    primaryNotificationEmail: string | null;
  };
  notifications: {
    notificationEmails: string[];
    dailyInboxEnabled: boolean;
    weeklyDigestEnabled: boolean;
    slack_enabled?: boolean;
    slack_webhook_url?: string | null;
    email_enabled?: boolean;
  };
  approvals: {
    defaultReviewSlaHours: number | null;
    requireEvidenceBeforeApproval: boolean;
  };
  domains: {
    activeDomains: { key: string; name: string; enabled: boolean }[];
    defaults: unknown[];
  };
  integrations: {
    slackConnected: boolean;
  };
};

function normalizeEmails(raw: string[] | null | undefined): string[] {
  if (!raw) return [];
  const cleaned = raw
    .map((s) => String(s).trim().toLowerCase())
    .filter(Boolean)
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
  return Array.from(new Set(cleaned));
}

function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

async function requireAdmin(orgId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return { ok: false as const, status: 401, user: null, supabase };
  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (!member || !isAdminLikeRole(parseOrgRole(member.role ?? null)))
    return { ok: false as const, status: 403, user: userRes.user, supabase };
  return { ok: true as const, status: null, user: userRes.user, supabase };
}

/**
 * GET /api/org/settings?orgId= — Consolidated org settings (any org member).
 * Returns Task 10 shape; legacy callers can still use response.settings for backward compat.
 */
export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = new URL(req.url).searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [orgRow, settingsResult, digestRow, domainsRows, slackRow] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", orgId).maybeSingle(),
    supabase
      .from("organization_settings")
      .select(
        "org_id, slack_enabled, slack_webhook_url, email_enabled, notification_emails, timezone, primary_notification_email, default_review_sla_hours, require_evidence_before_approval, daily_inbox_enabled"
      )
      .eq("org_id", orgId)
      .maybeSingle()
      .then((r) => (r.error ? supabase.from("organization_settings").select("org_id, slack_enabled, slack_webhook_url, email_enabled, notification_emails").eq("org_id", orgId).maybeSingle() : r))
      .then((r) => ({ data: r.data, error: r.error })),
    supabase.from("digest_settings").select("enabled, timezone").eq("org_id", orgId).maybeSingle(),
    supabase.from("org_domains").select("domain_key, enabled").eq("org_id", orgId).then((r) => r.data ?? []),
    supabase.from("slack_installations").select("org_id").eq("org_id", orgId).maybeSingle(),
  ]);

  const settingsRow = settingsResult.data;
  const org = orgRow as { name?: string } | null;
  const settings = settingsRow as {
    timezone?: string | null;
    primary_notification_email?: string | null;
    default_review_sla_hours?: number | null;
    require_evidence_before_approval?: boolean | null;
    daily_inbox_enabled?: boolean | null;
    notification_emails?: string[] | null;
    slack_enabled?: boolean | null;
    slack_webhook_url?: string | null;
    email_enabled?: boolean | null;
  } | null;
  const digest = digestRow as { enabled?: boolean; timezone?: string | null } | null;
  const domainKeys = (domainsRows as { domain_key: string; enabled: boolean }[]).map((d) => d.domain_key);

  let domainNames: Record<string, string> = {};
  if (domainKeys.length > 0) {
    const { data: dRows } = await supabase.from("domains").select("key, name").in("key", domainKeys);
    domainNames = Object.fromEntries((dRows ?? []).map((d: { key: string; name: string }) => [d.key, d.name]));
  }

  const payload: OrgSettingsPayload = {
    organization: {
      name: org?.name?.trim() ?? "",
      timezone: settings?.timezone?.trim() || digest?.timezone?.trim() || "UTC",
      primaryNotificationEmail: settings?.primary_notification_email?.trim() || null,
    },
    notifications: {
      notificationEmails: normalizeEmails(settings?.notification_emails ?? []),
      dailyInboxEnabled: Boolean(settings?.daily_inbox_enabled),
      weeklyDigestEnabled: Boolean(digest?.enabled),
      slack_enabled: Boolean(settings?.slack_enabled),
      slack_webhook_url: settings?.slack_webhook_url ?? null,
      email_enabled: Boolean(settings?.email_enabled),
    },
    approvals: {
      defaultReviewSlaHours:
        settings?.default_review_sla_hours != null ? Number(settings.default_review_sla_hours) : null,
      requireEvidenceBeforeApproval: Boolean(settings?.require_evidence_before_approval ?? true),
    },
    domains: {
      activeDomains: (domainsRows as { domain_key: string; enabled: boolean }[]).map((d) => ({
        key: d.domain_key,
        name: domainNames[d.domain_key] ?? d.domain_key,
        enabled: d.enabled,
      })),
      defaults: [],
    },
    integrations: {
      slackConnected: !!slackRow?.data,
    },
  };

  return NextResponse.json({ ok: true, settings: payload });
}

/**
 * PUT /api/org/settings — Update consolidated org settings (admin only). Body: { orgId, ...OrgSettingsPayload }.
 */
export async function PUT(req: NextRequest) {
  let body: { orgId?: string; organization?: OrgSettingsPayload["organization"]; notifications?: OrgSettingsPayload["notifications"]; approvals?: OrgSettingsPayload["approvals"] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const orgId = body.orgId;
  if (!orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

  const auth = await requireAdmin(orgId);
  if (!auth.ok) return NextResponse.json({ error: auth.status === 401 ? "Unauthorized" : "Forbidden" }, { status: auth.status! });

  const org = body.organization;
  const notifications = body.notifications;
  const approvals = body.approvals;

  // Validation
  if (org?.name !== undefined) {
    const name = String(org.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
  }
  if (org?.timezone !== undefined) {
    if (!isValidTimezone(org.timezone))
      return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });
  }
  if (org?.primaryNotificationEmail !== undefined && org.primaryNotificationEmail) {
    const email = String(org.primaryNotificationEmail).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return NextResponse.json({ error: "Invalid primary notification email" }, { status: 400 });
  }
  if (notifications?.notificationEmails !== undefined) {
    const emails = normalizeEmails(notifications.notificationEmails);
    const invalid = (notifications.notificationEmails ?? []).filter(
      (e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e).trim())
    );
    if (invalid.length > 0)
      return NextResponse.json({ error: "Invalid email address in notification list" }, { status: 400 });
  }
  if (approvals?.defaultReviewSlaHours !== undefined && approvals.defaultReviewSlaHours != null) {
    const hours = Number(approvals.defaultReviewSlaHours);
    if (!Number.isInteger(hours) || hours < 1 || hours > 720)
      return NextResponse.json({ error: "Default review SLA must be between 1 and 720 hours" }, { status: 400 });
  }

  const admin = createAdminClient();
  const actorId = auth.user!.id;

  if (org?.name !== undefined) {
    const { error: e } = await admin.from("organizations").update({ name: String(org.name).trim() }).eq("id", orgId);
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
    await auditLog(admin, { orgId, actorId, actorType: "USER", action: "organization_settings_updated", entityType: "organization", entityId: orgId, metadata: { section: "organization_profile" } });
  }

  const hasSettingsUpdates =
    org?.timezone !== undefined ||
    org?.primaryNotificationEmail !== undefined ||
    notifications?.notificationEmails !== undefined ||
    notifications?.dailyInboxEnabled !== undefined ||
    notifications?.slack_enabled !== undefined ||
    notifications?.slack_webhook_url !== undefined ||
    notifications?.email_enabled !== undefined ||
    approvals?.defaultReviewSlaHours !== undefined ||
    approvals?.requireEvidenceBeforeApproval !== undefined;

  if (hasSettingsUpdates) {
    const { data: existing } = await admin
      .from("organization_settings")
      .select("*")
      .eq("org_id", orgId)
      .maybeSingle();
    const cur = (existing ?? {}) as Record<string, unknown>;
    const settingsUpdates: Record<string, unknown> = {
      org_id: orgId,
      slack_enabled: notifications?.slack_enabled ?? cur.slack_enabled ?? false,
      slack_webhook_url: notifications?.slack_webhook_url !== undefined ? (notifications.slack_webhook_url?.trim() || null) : (cur.slack_webhook_url ?? null),
      email_enabled: notifications?.email_enabled ?? cur.email_enabled ?? false,
      notification_emails:
        notifications?.notificationEmails !== undefined
          ? (normalizeEmails(notifications.notificationEmails).length ? normalizeEmails(notifications.notificationEmails) : null)
          : (cur.notification_emails ?? null),
      timezone: org?.timezone !== undefined ? String(org.timezone).trim() || "UTC" : (cur.timezone ?? "UTC"),
      primary_notification_email: org?.primaryNotificationEmail !== undefined ? org.primaryNotificationEmail?.trim() || null : (cur.primary_notification_email ?? null),
      default_review_sla_hours: approvals?.defaultReviewSlaHours !== undefined ? approvals.defaultReviewSlaHours : (cur.default_review_sla_hours ?? null),
      require_evidence_before_approval: approvals?.requireEvidenceBeforeApproval ?? cur.require_evidence_before_approval ?? true,
      daily_inbox_enabled: notifications?.dailyInboxEnabled ?? cur.daily_inbox_enabled ?? false,
    };
    const { error: e } = await admin.from("organization_settings").upsert(settingsUpdates as Record<string, never>, { onConflict: "org_id" });
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
    await auditLog(admin, { orgId, actorId, actorType: "USER", action: "notification_settings_updated", entityType: "organization_settings", entityId: orgId, metadata: {} });
    if (approvals?.defaultReviewSlaHours !== undefined || approvals?.requireEvidenceBeforeApproval !== undefined) {
      await auditLog(admin, { orgId, actorId, actorType: "USER", action: "approval_defaults_updated", entityType: "organization_settings", entityId: orgId, metadata: {} });
    }
  }

  if (notifications?.weeklyDigestEnabled !== undefined) {
    const tz = org?.timezone?.trim() || "UTC";
    const { error: e } = await admin
      .from("digest_settings")
      .upsert(
        { org_id: orgId, enabled: Boolean(notifications.weeklyDigestEnabled), timezone: tz },
        { onConflict: "org_id" }
      );
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * POST /api/org/settings — Legacy: update slack/email/notification_emails only (admin only).
 */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as SaveBody | null;
  if (!body?.orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

  const auth = await requireAdmin(body.orgId);
  if (!auth.ok) return NextResponse.json({ error: auth.status === 401 ? "Unauthorized" : "Forbidden" }, { status: auth.status! });

  const slackWebhook =
    body.slack_webhook_url && body.slack_webhook_url.trim().length > 0 ? body.slack_webhook_url.trim() : null;
  const emails = normalizeEmails(body.notification_emails);
  const { error } = await supabase
    .from("organization_settings")
    .upsert(
      {
        org_id: body.orgId,
        slack_enabled: Boolean(body.slack_enabled),
        slack_webhook_url: slackWebhook,
        email_enabled: Boolean(body.email_enabled),
        notification_emails: emails.length ? emails : null,
      },
      { onConflict: "org_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
