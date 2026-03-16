import type { SupabaseClient } from "@supabase/supabase-js";
import { canReviewDomain, canViewChange } from "@/lib/access/changeAccess";

type Db = SupabaseClient;

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
  if (templateKey === "high_risk_change_detected") {
    const { data: admins } = await db
      .from("organization_members")
      .select("user_id")
      .eq("org_id", orgId)
      .in("role", ["owner", "admin"])
      .limit(20);
    return [...new Set((admins ?? []).map((x) => x.user_id).filter(Boolean))];
  }

  const changeEventId = (payload.changeEventId ?? payload.change_event_id) as string | undefined;
  if (!changeEventId) return [];
  const { data: change } = await db
    .from("change_events")
    .select("id, org_id, domain, status, created_by, is_restricted")
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
