import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CoordinationInput } from "./coordinationTypes";

function hash(v: unknown): string {
  return createHash("sha256").update(JSON.stringify(v)).digest("hex");
}

function norm(v: unknown): string {
  return String(v ?? "").trim();
}

function normArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

export function buildCoordinationInputHash(input: {
  change: Record<string, unknown>;
  mappingSignature: unknown;
  roleSignature: unknown;
  notificationSignature: unknown;
}): string {
  return hash(input);
}

export async function buildCoordinationInput(args: {
  supabase: SupabaseClient;
  changeId: string;
}): Promise<CoordinationInput> {
  const { data: change, error: chErr } = await scopeActiveChangeEvents(args.supabase.from("change_events").select("*"))
    .eq("id", args.changeId)
    .maybeSingle();
  if (chErr) throw new Error(chErr.message);
  if (!change) throw new Error("Change not found");

  const orgId = String(change.org_id);
  const systems = normArr(change.systems_involved);
  const revenueImpactArea = normArr(change.revenue_impact_areas);

  const [{ data: evidenceRows }, { data: approvalsRows }, { data: mappingsRows }, { data: settings }, { data: slackInstall }] =
    await Promise.all([
      args.supabase
        .from("change_evidence_items")
        .select("id, kind, label, severity, status")
        .eq("change_event_id", args.changeId),
      args.supabase
        .from("approvals")
        .select("approver_user_id, approval_area, decision")
        .eq("change_event_id", args.changeId),
      args.supabase
        .from("approval_mappings")
        .select("trigger_type, trigger_value, approval_role_id, enabled, priority, updated_at")
        .eq("org_id", orgId),
      args.supabase
        .from("organization_settings")
        .select("email_enabled, notification_emails, slack_enabled, updated_at")
        .eq("org_id", orgId)
        .maybeSingle(),
      args.supabase
        .from("slack_installations")
        .select("default_channel_id, updated_at")
        .eq("org_id", orgId)
        .maybeSingle(),
    ]);

  const roleIds = Array.from(
    new Set((mappingsRows ?? []).map((m) => String(m.approval_role_id)).filter(Boolean))
  );
  const [{ data: rolesRows }, { data: roleMembersRows }, { data: domainPermRows }] = await Promise.all([
    roleIds.length
      ? args.supabase
          .from("approval_roles")
          .select("id, role_name, enabled, updated_at")
          .eq("org_id", orgId)
          .in("id", roleIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    roleIds.length
      ? args.supabase
          .from("approval_role_members")
          .select("role_id, user_id, created_at")
          .eq("org_id", orgId)
          .in("role_id", roleIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    args.supabase
      .from("user_domain_permissions")
      .select("user_id, can_review")
      .eq("org_id", orgId)
      .eq("domain", norm(change.domain || "REVENUE")),
  ]);

  const roleNameById = new Map(
    (rolesRows ?? []).map((r) => [String(r.id), String(r.role_name)])
  );
  const memberIds = Array.from(
    new Set((roleMembersRows ?? []).map((r) => String(r.user_id)).filter(Boolean))
  );
  const canReviewByUser = new Map(
    (domainPermRows ?? []).map((p) => [String(p.user_id), Boolean(p.can_review)])
  );

  const roleMembers = (roleMembersRows ?? []).map((rm) => {
    const userId = String(rm.user_id);
    return {
      roleId: String(rm.role_id),
      roleName: roleNameById.get(String(rm.role_id)) ?? "Unknown Role",
      userId,
      email: null,
      name: null,
      canReview: canReviewByUser.has(userId) ? Boolean(canReviewByUser.get(userId)) : true,
    };
  });

  const approvalMappings = (mappingsRows ?? []).map((m) => ({
    triggerType: String(m.trigger_type) as "DOMAIN" | "SYSTEM" | "CHANGE_TYPE",
    triggerValue: String(m.trigger_value),
    roleId: String(m.approval_role_id),
    roleName: roleNameById.get(String(m.approval_role_id)) ?? "Unknown Role",
    enabled: Boolean(m.enabled),
    priority: Number(m.priority ?? 100),
  }));

  const mappingSignature = (mappingsRows ?? []).map((m) => ({
    trigger_type: m.trigger_type,
    trigger_value: m.trigger_value,
    approval_role_id: m.approval_role_id,
    enabled: m.enabled,
    priority: m.priority,
    updated_at: m.updated_at,
  }));
  const roleSignature = {
    roles: (rolesRows ?? []).map((r) => ({ id: r.id, enabled: r.enabled, updated_at: r.updated_at })),
    members: (roleMembersRows ?? []).map((r) => ({ role_id: r.role_id, user_id: r.user_id, created_at: r.created_at })),
    perms: (domainPermRows ?? []).map((p) => ({ user_id: p.user_id, can_review: p.can_review })),
  };
  const notificationSignature = {
    settings: settings ?? null,
    slackInstall: slackInstall ?? null,
  };

  const inputHash = buildCoordinationInputHash({
    change: {
      changeType: change.structured_change_type ?? change.change_type,
      domain: change.domain,
      systems,
      rolloutMethod: change.rollout_method,
      backfillRequired: change.backfill_required,
      customerImpact: change.customer_impact_expected,
      visibility: change.visibility ?? null,
      isRestricted: Boolean(change.is_restricted),
    },
    mappingSignature,
    roleSignature,
    notificationSignature,
  });

  return {
    inputHash,
    change: {
      id: String(change.id),
      orgId,
      title: norm(change.title) || null,
      description: norm((change.intake as Record<string, unknown> | null)?.description) || null,
      changeType: norm(change.structured_change_type ?? change.change_type) || null,
      domain: norm(change.domain || "REVENUE"),
      systems,
      revenueImpactArea,
      customerImpact:
        typeof change.customer_impact_expected === "boolean"
          ? Boolean(change.customer_impact_expected)
          : null,
      rolloutMethod: norm(change.rollout_method) || null,
      backfillRequired:
        typeof change.backfill_required === "boolean" ? Boolean(change.backfill_required) : null,
      status: norm(change.status) || null,
      authorId: norm(change.created_by) || null,
      visibility: norm(change.visibility) || null,
      isRestricted: Boolean(change.is_restricted),
      evidenceItems: (evidenceRows ?? []).map((e) => ({
        id: e.id as string,
        kind: String(e.kind),
        label: String(e.label),
        severity: String(e.severity ?? ""),
        status: String(e.status ?? ""),
      })),
      approvers: (approvalsRows ?? []).map((a) => ({
        userId: String(a.approver_user_id),
        approvalArea: String(a.approval_area ?? ""),
        decision: String(a.decision ?? "PENDING"),
      })),
    },
    org: {
      approvalMappings,
      roleMembers,
      notificationSettings: {
        emailEnabled: Boolean(settings?.email_enabled),
        notificationEmails: Array.isArray(settings?.notification_emails)
          ? (settings?.notification_emails as string[])
          : [],
        slackEnabled: Boolean(settings?.slack_enabled),
        slackDefaultChannelId: (slackInstall?.default_channel_id as string | null) ?? null,
      },
    },
  };
}
