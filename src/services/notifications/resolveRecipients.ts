import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canReviewDomain, canViewChange } from "@/lib/access/changeAccess";

type Db = SupabaseClient;

async function userMutedPrediction(db: Db, orgId: string, userId: string, ptype: string) {
  const { data } = await db
    .from("notification_mutes")
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .eq("mute_type", "PREDICTION_TYPE")
    .eq("mute_value", ptype)
    .gt("expires_at", new Date().toISOString())
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/**
 * Resolve IN_APP recipient user IDs for a notification template.
 * Used by the notification process job to fan out to in_app_notifications.
 */
export async function resolveRecipientsForTemplate(
  db: Db,
  orgId: string,
  templateKey: string,
  payload: Record<string, unknown>
): Promise<string[]> {
  if (templateKey === "outcomes_report_ready" || templateKey === "outcomes_report_failed") {
    const raw = payload.recipientUserIds;
    if (Array.isArray(raw)) {
      return [...new Set(raw.map((x) => String(x)).filter(Boolean))];
    }
    return [];
  }

  if (templateKey === "outcomes_threshold") {
    const ids = new Set<string>();
    const { data: execUsers } = await db
      .from("organization_member_roles")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("role_key", "EXEC");
    for (const u of execUsers ?? []) {
      const id = (u as { user_id?: string }).user_id;
      if (id) ids.add(id);
    }
    const { data: owners } = await db
      .from("organization_members")
      .select("user_id, role")
      .eq("org_id", orgId)
      .in("role", ["owner", "admin"]);
    for (const u of owners ?? []) {
      const id = (u as { user_id?: string }).user_id;
      const role = String((u as { role?: string }).role ?? "");
      if (id && role === "owner") ids.add(id);
    }
    const { data: settings } = await db
      .from("organization_settings")
      .select("notify_admins_on_outcomes")
      .eq("org_id", orgId)
      .maybeSingle();
    if ((settings as { notify_admins_on_outcomes?: boolean } | null)?.notify_admins_on_outcomes) {
      for (const u of owners ?? []) {
        const id = (u as { user_id?: string }).user_id;
        const role = String((u as { role?: string }).role ?? "");
        if (id && role === "admin") ids.add(id);
      }
    }
    return [...ids];
  }

  if (templateKey === "high_risk_change_detected") {
    const { data: admins } = await db
      .from("organization_members")
      .select("user_id")
      .eq("org_id", orgId)
      .in("role", ["owner", "admin"])
      .limit(20);
    return [...new Set((admins ?? []).map((x) => x.user_id).filter(Boolean))];
  }

  if (templateKey === "predicted_risk_early_warning") {
    const changeEventId = (payload.changeEventId ?? payload.change_event_id) as string | undefined;
    const predictionType = String(payload.predictionType ?? "");
    if (!changeEventId || !predictionType) return [];

    const { data: change } = await scopeActiveChangeEvents(
      db.from("change_events").select("id, org_id, domain, status, created_by, is_restricted")
    )
      .eq("id", changeEventId)
      .maybeSingle();
    if (!change) return [];
    const changeRow = change as {
      id: string;
      org_id: string;
      domain: string | null;
      status: string | null;
      created_by: string | null;
      is_restricted: boolean | null;
    };

    const { data: execUsers } = await db
      .from("organization_member_roles")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("role_key", "EXEC");
    let candidates = (execUsers ?? []).map((u) => (u as { user_id: string }).user_id).filter(Boolean);
    if (candidates.length === 0) {
      const { data: admins } = await db
        .from("organization_members")
        .select("user_id")
        .eq("org_id", orgId)
        .in("role", ["owner", "admin"])
        .limit(12);
      candidates = (admins ?? []).map((a) => (a as { user_id: string }).user_id).filter(Boolean);
    }

    const out: string[] = [];
    for (const uid of [...new Set(candidates)]) {
      if (!(await canViewChange(db, uid, changeRow))) continue;
      const { data: pref } = await db
        .from("user_notification_preferences")
        .select("receive_early_warnings")
        .eq("user_id", uid)
        .maybeSingle();
      if (pref && (pref as { receive_early_warnings?: boolean }).receive_early_warnings === false) continue;
      if (await userMutedPrediction(db, orgId, uid, predictionType)) continue;
      out.push(uid);
    }
    return out;
  }

  if (templateKey === "portfolio_deterioration") {
    const changeEventId = (payload.changeEventId ?? payload.change_event_id) as string | undefined;
    if (!changeEventId) return [];

    const { data: change } = await scopeActiveChangeEvents(
      db.from("change_events").select("id, org_id, domain, status, created_by, is_restricted")
    )
      .eq("id", changeEventId)
      .maybeSingle();
    if (!change) return [];
    const changeRow = change as {
      id: string;
      org_id: string;
      domain: string | null;
      status: string | null;
      created_by: string | null;
      is_restricted: boolean | null;
    };

    const { data: execUsers } = await db
      .from("organization_member_roles")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("role_key", "EXEC");
    let candidates = (execUsers ?? []).map((u) => (u as { user_id: string }).user_id).filter(Boolean);
    if (candidates.length === 0) {
      const { data: admins } = await db
        .from("organization_members")
        .select("user_id")
        .eq("org_id", orgId)
        .in("role", ["owner", "admin"])
        .limit(12);
      candidates = (admins ?? []).map((a) => (a as { user_id: string }).user_id).filter(Boolean);
    }

    const out: string[] = [];
    for (const uid of [...new Set(candidates)]) {
      if (!(await canViewChange(db, uid, changeRow))) continue;
      const { data: pref } = await db
        .from("user_notification_preferences")
        .select("receive_early_warnings")
        .eq("user_id", uid)
        .maybeSingle();
      if (pref && (pref as { receive_early_warnings?: boolean }).receive_early_warnings === false) continue;
      out.push(uid);
    }
    return out;
  }

  if (templateKey === "readiness_band_cross") {
    const changeEventId = (payload.changeEventId ?? payload.change_event_id) as string | undefined;
    if (!changeEventId) return [];

    const { data: change } = await scopeActiveChangeEvents(
      db.from("change_events").select("id, org_id, domain, status, created_by, is_restricted")
    )
      .eq("id", changeEventId)
      .maybeSingle();
    if (!change) return [];
    const changeRow = change as {
      id: string;
      org_id: string;
      domain: string | null;
      status: string | null;
      created_by: string | null;
      is_restricted: boolean | null;
    };

    const { data: execUsers } = await db
      .from("organization_member_roles")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("role_key", "EXEC");
    let candidates = (execUsers ?? []).map((u) => (u as { user_id: string }).user_id).filter(Boolean);
    if (candidates.length === 0) {
      const { data: admins } = await db
        .from("organization_members")
        .select("user_id")
        .eq("org_id", orgId)
        .in("role", ["owner", "admin"])
        .limit(12);
      candidates = (admins ?? []).map((a) => (a as { user_id: string }).user_id).filter(Boolean);
    }

    const out: string[] = [];
    for (const uid of [...new Set(candidates)]) {
      if (!(await canViewChange(db, uid, changeRow))) continue;
      const { data: pref } = await db
        .from("user_notification_preferences")
        .select("receive_early_warnings")
        .eq("user_id", uid)
        .maybeSingle();
      if (pref && (pref as { receive_early_warnings?: boolean }).receive_early_warnings === false) continue;
      out.push(uid);
    }
    return out;
  }

  const changeEventId = (payload.changeEventId ?? payload.change_event_id) as string | undefined;
  if (!changeEventId) return [];
  const { data: change } = await scopeActiveChangeEvents(db.from("change_events").select("id, org_id, domain, status, created_by, is_restricted"))
    .eq("id", changeEventId)
    .maybeSingle();
  if (!change) return [];
  const changeRow = change as {
    id: string;
    org_id: string;
    domain: string | null;
    status: string | null;
    created_by: string | null;
    is_restricted: boolean | null;
  };

  async function filterViewable(userIds: string[]) {
    const uniqueIds = [...new Set(userIds.filter(Boolean))];
    const out: string[] = [];
    for (const uid of uniqueIds) {
      if (await canViewChange(db, uid, changeRow)) out.push(uid);
    }
    return out;
  }

  switch (templateKey) {
    case "approval_requested": {
      const { data: approvals } = await db
        .from("approvals")
        .select("approver_user_id, decision")
        .eq("change_event_id", changeEventId);
      const pending = (approvals ?? [])
        .filter((a) => a.decision === "PENDING")
        .map((a) => a.approver_user_id)
        .filter(Boolean);
      if (pending.length > 0) {
        const allowed: string[] = [];
        for (const userId of [...new Set(pending)]) {
          const hasDomainReview = await canReviewDomain(db, userId, orgId, changeRow.domain);
          if (hasDomainReview && (await canViewChange(db, userId, changeRow))) {
            allowed.push(userId);
          }
        }
        return allowed;
      }

      const { data: admins } = await db
        .from("organization_members")
        .select("user_id")
        .eq("org_id", orgId)
        .in("role", ["owner", "admin"])
        .limit(10);
      if ((admins ?? []).length > 0) {
        return filterViewable((admins ?? []).map((x) => x.user_id).filter(Boolean));
      }

      return changeRow.created_by ? filterViewable([changeRow.created_by]) : [];
    }

    case "change_submitted":
    case "change_approved":
    case "change_rejected":
    case "change_reopened": {
      return changeRow.created_by ? filterViewable([changeRow.created_by]) : [];
    }

    case "comment_added": {
      const ownerId = changeRow.created_by ?? null;
      const authorId = (payload.actorUserId ?? payload.actor_user_id) as string | undefined;
      const ids = new Set<string>();
      if (ownerId) ids.add(ownerId);
      if (authorId) ids.delete(authorId);
      return filterViewable([...ids]);
    }

    case "evidence_missing":
    case "evidence_requested":
    case "evidence_updated":
    case "approval_due_soon":
    case "approval_overdue":
    case "sla_due_soon":
    case "sla_overdue":
    case "sla_escalated": {
      const ownerId = changeRow.created_by ?? null;
      if (ownerId) {
        const pendingApprovers = await db
          .from("approvals")
          .select("approver_user_id")
          .eq("change_event_id", changeEventId)
          .eq("decision", "PENDING");
        const approverIds = (pendingApprovers.data ?? []).map((a) => a.approver_user_id).filter(Boolean);
        return filterViewable([...new Set([ownerId, ...approverIds])]);
      }
      return [];
    }

    default:
      return [];
  }
}
