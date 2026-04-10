import { NextRequest, NextResponse } from "next/server";
import { createPrivilegedClient } from "@/lib/server/adminClient";
import { auditLog } from "@/lib/audit";
import {
  authzErrorResponse,
  parseRequestedOrgId,
  requireOrgPermission,
} from "@/lib/server/authz";
import { ORG_ATTENTION_SETTINGS_SELECT, resolveOrgAttentionSettings } from "@/lib/attention/orgAttentionDefaults";

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
  intake: {
    adoptionMode: "NATIVE_FIRST" | "MANUAL_FIRST" | "HYBRID" | null;
  };
  attentionRouting: {
    executiveRevenueEscalationThresholdUsd: number;
    seniorTechRevenueEscalationThresholdUsd: number;
    departmentLeaderRevenueEscalationThresholdUsd: number;
    immediateDeployWindowHours: number;
    digestIncludeMediumRisk: boolean;
    suppressLowRiskExecNotifications: boolean;
    executiveDefaultRoute: "IMMEDIATE" | "DAILY_DIGEST" | "WEEKLY_DIGEST";
    seniorTechDefaultRoute: "IMMEDIATE" | "DAILY_DIGEST" | "WEEKLY_DIGEST";
    departmentLeaderDefaultRoute: "IMMEDIATE" | "DAILY_DIGEST" | "WEEKLY_DIGEST";
    operatorDefaultRoute: "IMMEDIATE" | "DAILY_DIGEST" | "WEEKLY_DIGEST";
    attentionDailyDigestEnabled: boolean;
    attentionWeeklyDigestEnabled: boolean;
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

/**
 * GET /api/org/settings?orgId= — Consolidated org settings (org.settings.view).
 * Returns Task 10 shape; legacy callers can still use response.settings for backward compat.
 */
export async function GET(req: Request) {
  try {
    const orgIdParam = new URL(req.url).searchParams.get("orgId");
    if (!orgIdParam) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    const orgId = parseRequestedOrgId(orgIdParam);
    const ctx = await requireOrgPermission(orgId, "org.settings.view");
    const supabase = ctx.supabase;

  const [orgRow, settingsResult, digestRow, domainsRows, slackRow] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", orgId).maybeSingle(),
    supabase
      .from("organization_settings")
      .select(
        `org_id, slack_enabled, slack_webhook_url, email_enabled, notification_emails, timezone, primary_notification_email, default_review_sla_hours, require_evidence_before_approval, daily_inbox_enabled, adoption_mode, ${ORG_ATTENTION_SETTINGS_SELECT}`
      )
      .eq("org_id", orgId)
      .maybeSingle()
      .then((r) =>
        r.error
          ? supabase
              .from("organization_settings")
              .select("org_id, slack_enabled, slack_webhook_url, email_enabled, notification_emails")
              .eq("org_id", orgId)
              .maybeSingle()
          : r
      )
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
    adoption_mode?: string | null;
  } | null;
  const digest = digestRow as { enabled?: boolean; timezone?: string | null } | null;
  const domainKeys = (domainsRows as { domain_key: string; enabled: boolean }[]).map((d) => d.domain_key);

  let domainNames: Record<string, string> = {};
  if (domainKeys.length > 0) {
    const { data: dRows } = await supabase.from("domains").select("key, name").in("key", domainKeys);
    domainNames = Object.fromEntries((dRows ?? []).map((d: { key: string; name: string }) => [d.key, d.name]));
  }

  const ar = resolveOrgAttentionSettings(settings as Record<string, unknown> | null);
  const attentionRouting: OrgSettingsPayload["attentionRouting"] = {
    executiveRevenueEscalationThresholdUsd: ar.executiveRevenueThresholdUsd,
    seniorTechRevenueEscalationThresholdUsd: ar.seniorTechRevenueThresholdUsd,
    departmentLeaderRevenueEscalationThresholdUsd: ar.departmentLeaderRevenueThresholdUsd,
    immediateDeployWindowHours: ar.immediateDeployWindowHours,
    digestIncludeMediumRisk: ar.digestIncludeMediumRisk,
    suppressLowRiskExecNotifications: ar.suppressLowRiskExecNotifications,
    executiveDefaultRoute: ar.executiveDefaultRoute,
    seniorTechDefaultRoute: ar.seniorTechDefaultRoute,
    departmentLeaderDefaultRoute: ar.departmentLeaderDefaultRoute,
    operatorDefaultRoute: ar.operatorDefaultRoute,
    attentionDailyDigestEnabled: ar.attentionDailyDigestEnabled,
    attentionWeeklyDigestEnabled: ar.attentionWeeklyDigestEnabled,
  };

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
    intake: {
      adoptionMode:
        (settings?.adoption_mode as OrgSettingsPayload["intake"]["adoptionMode"]) ?? "HYBRID",
    },
    attentionRouting,
  };

    return NextResponse.json({ ok: true, settings: payload });
  } catch (e) {
    return authzErrorResponse(e);
  }
}

/**
 * PUT /api/org/settings — Update consolidated org settings (org.settings.manage). Body: { orgId, ...OrgSettingsPayload }.
 */
export async function PUT(req: NextRequest) {
  try {
    let body: {
      orgId?: string;
      organization?: OrgSettingsPayload["organization"];
      notifications?: OrgSettingsPayload["notifications"];
      approvals?: OrgSettingsPayload["approvals"];
      intake?: Partial<OrgSettingsPayload["intake"]>;
      attentionRouting?: Partial<OrgSettingsPayload["attentionRouting"]>;
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (!body.orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    const orgId = parseRequestedOrgId(body.orgId);

    const ctx = await requireOrgPermission(orgId, "org.settings.manage");

    const org = body.organization;
    const notifications = body.notifications;
    const approvals = body.approvals;
    const attentionRouting = body.attentionRouting;
    const intake = body.intake;

    const ADOPTION = new Set(["NATIVE_FIRST", "MANUAL_FIRST", "HYBRID"]);
    if (intake?.adoptionMode !== undefined && intake.adoptionMode !== null) {
      if (!ADOPTION.has(intake.adoptionMode)) {
        return NextResponse.json({ error: "Invalid adoption mode" }, { status: 400 });
      }
    }

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

    const ROUTE_SET = new Set(["IMMEDIATE", "DAILY_DIGEST", "WEEKLY_DIGEST"]);
    if (attentionRouting) {
      const th = [
        attentionRouting.executiveRevenueEscalationThresholdUsd,
        attentionRouting.seniorTechRevenueEscalationThresholdUsd,
        attentionRouting.departmentLeaderRevenueEscalationThresholdUsd,
      ];
      for (const t of th) {
        if (t !== undefined && (typeof t !== "number" || !Number.isFinite(t) || t < 0)) {
          return NextResponse.json({ error: "Invalid attention revenue threshold" }, { status: 400 });
        }
      }
      if (
        attentionRouting.immediateDeployWindowHours !== undefined &&
        (!Number.isInteger(attentionRouting.immediateDeployWindowHours) ||
          attentionRouting.immediateDeployWindowHours < 1 ||
          attentionRouting.immediateDeployWindowHours > 168)
      ) {
        return NextResponse.json({ error: "Deploy window hours must be 1–168" }, { status: 400 });
      }
      for (const k of [
        "executiveDefaultRoute",
        "seniorTechDefaultRoute",
        "departmentLeaderDefaultRoute",
        "operatorDefaultRoute",
      ] as const) {
        const v = attentionRouting[k];
        if (v !== undefined && !ROUTE_SET.has(v)) {
          return NextResponse.json({ error: "Invalid default route" }, { status: 400 });
        }
      }
    }

    const admin = createPrivilegedClient("PUT /api/org/settings: org row + organization_settings upserts");
    const actorId = ctx.user.id;

    if (org?.name !== undefined) {
      const { error: e } = await admin.from("organizations").update({ name: String(org.name).trim() }).eq("id", orgId);
      if (e) return NextResponse.json({ error: e.message }, { status: 500 });
      await auditLog(admin, {
        orgId,
        actorId,
        actorType: "USER",
        action: "organization_settings_updated",
        entityType: "organization",
        entityId: orgId,
        metadata: { section: "organization_profile" },
      });
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
      approvals?.requireEvidenceBeforeApproval !== undefined ||
      intake?.adoptionMode !== undefined ||
      attentionRouting !== undefined;

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
        slack_webhook_url:
          notifications?.slack_webhook_url !== undefined
            ? notifications.slack_webhook_url?.trim() || null
            : (cur.slack_webhook_url ?? null),
        email_enabled: notifications?.email_enabled ?? cur.email_enabled ?? false,
        notification_emails:
          notifications?.notificationEmails !== undefined
            ? normalizeEmails(notifications.notificationEmails).length
              ? normalizeEmails(notifications.notificationEmails)
              : null
            : (cur.notification_emails ?? null),
        timezone: org?.timezone !== undefined ? String(org.timezone).trim() || "UTC" : (cur.timezone ?? "UTC"),
        primary_notification_email:
          org?.primaryNotificationEmail !== undefined
            ? org.primaryNotificationEmail?.trim() || null
            : (cur.primary_notification_email ?? null),
        default_review_sla_hours:
          approvals?.defaultReviewSlaHours !== undefined
            ? approvals.defaultReviewSlaHours
            : (cur.default_review_sla_hours ?? null),
        require_evidence_before_approval:
          approvals?.requireEvidenceBeforeApproval ?? cur.require_evidence_before_approval ?? true,
        daily_inbox_enabled: notifications?.dailyInboxEnabled ?? cur.daily_inbox_enabled ?? false,
        executive_revenue_escalation_threshold_usd:
          attentionRouting?.executiveRevenueEscalationThresholdUsd ?? cur.executive_revenue_escalation_threshold_usd ?? 100000,
        senior_tech_revenue_escalation_threshold_usd:
          attentionRouting?.seniorTechRevenueEscalationThresholdUsd ?? cur.senior_tech_revenue_escalation_threshold_usd ?? 50000,
        department_leader_revenue_escalation_threshold_usd:
          attentionRouting?.departmentLeaderRevenueEscalationThresholdUsd ??
          cur.department_leader_revenue_escalation_threshold_usd ??
          25000,
        immediate_deploy_window_hours:
          attentionRouting?.immediateDeployWindowHours ?? cur.immediate_deploy_window_hours ?? 24,
        digest_include_medium_risk:
          attentionRouting?.digestIncludeMediumRisk ?? cur.digest_include_medium_risk ?? true,
        suppress_low_risk_exec_notifications:
          attentionRouting?.suppressLowRiskExecNotifications ?? cur.suppress_low_risk_exec_notifications ?? true,
        executive_default_route:
          attentionRouting?.executiveDefaultRoute ?? cur.executive_default_route ?? "IMMEDIATE",
        senior_tech_default_route:
          attentionRouting?.seniorTechDefaultRoute ?? cur.senior_tech_default_route ?? "IMMEDIATE",
        department_leader_default_route:
          attentionRouting?.departmentLeaderDefaultRoute ?? cur.department_leader_default_route ?? "IMMEDIATE",
        operator_default_route:
          attentionRouting?.operatorDefaultRoute ?? cur.operator_default_route ?? "IMMEDIATE",
        attention_daily_digest_enabled:
          attentionRouting?.attentionDailyDigestEnabled ?? cur.attention_daily_digest_enabled ?? false,
        attention_weekly_digest_enabled:
          attentionRouting?.attentionWeeklyDigestEnabled ?? cur.attention_weekly_digest_enabled ?? false,
        adoption_mode:
          intake?.adoptionMode !== undefined ? intake.adoptionMode : (cur.adoption_mode ?? "HYBRID"),
      };
      const { error: e } = await admin
        .from("organization_settings")
        .upsert(settingsUpdates as Record<string, never>, { onConflict: "org_id" });
      if (e) return NextResponse.json({ error: e.message }, { status: 500 });
      await auditLog(admin, {
        orgId,
        actorId,
        actorType: "USER",
        action: "notification_settings_updated",
        entityType: "organization_settings",
        entityId: orgId,
        metadata: {},
      });
      if (approvals?.defaultReviewSlaHours !== undefined || approvals?.requireEvidenceBeforeApproval !== undefined) {
        await auditLog(admin, {
          orgId,
          actorId,
          actorType: "USER",
          action: "approval_defaults_updated",
          entityType: "organization_settings",
          entityId: orgId,
          metadata: {},
        });
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
  } catch (e) {
    return authzErrorResponse(e);
  }
}

/**
 * POST /api/org/settings — Legacy: update slack/email/notification_emails only (org.settings.manage).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as SaveBody | null;
    if (!body?.orgId) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });

    const orgId = parseRequestedOrgId(body.orgId);
    const ctx = await requireOrgPermission(orgId, "org.settings.manage");

    const slackWebhook =
      body.slack_webhook_url && body.slack_webhook_url.trim().length > 0 ? body.slack_webhook_url.trim() : null;
    const emails = normalizeEmails(body.notification_emails);
    const { error } = await ctx.supabase
      .from("organization_settings")
      .upsert(
        {
          org_id: orgId,
          slack_enabled: Boolean(body.slack_enabled),
          slack_webhook_url: slackWebhook,
          email_enabled: Boolean(body.email_enabled),
          notification_emails: emails.length ? emails : null,
        },
        { onConflict: "org_id" }
      );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
