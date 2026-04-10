import type { SupabaseClient } from "@supabase/supabase-js";

export type ApprovalAuthRow = {
  approver_user_id: string;
  delegate_user_id?: string | null;
};

/**
 * Phase 4: assigned approver, or delegate when org allows and relationship matches.
 */
export async function canUserActOnApproval(
  admin: SupabaseClient,
  args: { orgId: string; approval: ApprovalAuthRow; actorUserId: string }
): Promise<boolean> {
  const { orgId, approval, actorUserId } = args;
  if (approval.approver_user_id === actorUserId) return true;

  const { data: settings } = await admin
    .from("organization_settings")
    .select("allow_delegate_approval")
    .eq("org_id", orgId)
    .maybeSingle();

  if (!(settings as { allow_delegate_approval?: boolean } | null)?.allow_delegate_approval) {
    return false;
  }

  if (approval.delegate_user_id && approval.delegate_user_id === actorUserId) {
    return true;
  }

  const { data: approverPrefs } = await admin
    .from("user_notification_preferences")
    .select("standing_delegate_user_id")
    .eq("user_id", approval.approver_user_id)
    .maybeSingle();

  const standing = (approverPrefs as { standing_delegate_user_id?: string | null } | null)
    ?.standing_delegate_user_id;
  if (standing && standing === actorUserId) return true;

  return false;
}
