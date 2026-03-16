import type { SupabaseClient } from "@supabase/supabase-js";
import type { CoordinationPlan } from "./coordinationTypes";

export async function applyApprovalSuggestions(args: {
  supabase: SupabaseClient;
  orgId: string;
  changeId: string;
  domain: string;
  plan: CoordinationPlan;
}) {
  const { data: existing, error: exErr } = await args.supabase
    .from("approvals")
    .select("approver_user_id, approval_area")
    .eq("change_event_id", args.changeId);
  if (exErr) throw new Error(exErr.message);

  const existingSet = new Set(
    (existing ?? []).map((e) => `${String(e.approver_user_id)}::${String(e.approval_area ?? "")}`)
  );
  const inserts = args.plan.approvals.suggestedApprovers
    .map((s) => ({
      change_event_id: args.changeId,
      org_id: args.orgId,
      domain: args.domain,
      approver_user_id: s.userId,
      approval_area: s.role,
      decision: "PENDING",
      comment: null,
      decided_at: null,
    }))
    .filter((row) => {
      const key = `${row.approver_user_id}::${row.approval_area}`;
      if (existingSet.has(key)) return false;
      existingSet.add(key);
      return true;
    });

  if (inserts.length === 0) return { inserted: 0 };
  const { error: insErr } = await args.supabase.from("approvals").insert(inserts);
  if (insErr) throw new Error(insErr.message);
  return { inserted: inserts.length };
}
