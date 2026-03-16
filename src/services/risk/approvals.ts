import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensureApprovalsForRequirements(
  supabase: SupabaseClient,
  args: {
    orgId: string;
    changeId: string;
    domain: string;
    riskBucket: string;
    isEscalated?: boolean;
    /** When set, use these instead of querying approval_requirements (e.g. from domain_approval_requirements). */
    requirementsOverride?: { role: string; min: number }[];
  }
): Promise<{ inserted: number }> {
  const { orgId, changeId, domain, riskBucket, isEscalated = false, requirementsOverride } = args;

  let required: { role: string; min: number }[];

  if (requirementsOverride && requirementsOverride.length > 0) {
    required = [...requirementsOverride];
  } else {
    const { data: reqs, error: reqErr } = await supabase
      .from("approval_requirements")
      .select("required_role, min_count")
      .eq("org_id", orgId)
      .eq("domain", domain)
      .eq("risk_bucket", riskBucket)
      .eq("enabled", true);

    if (reqErr) throw new Error(reqErr.message);

    required = (reqs ?? []).map((r) => ({
      role: String(r.required_role),
      min: Number(r.min_count ?? 1),
    }));
  }

  if (isEscalated && !required.some((r) => r.role === "EXEC")) {
    required.push({ role: "EXEC", min: 1 });
  }

  const { data: existing, error: exErr } = await supabase
    .from("approvals")
    .select("approval_area, approver_user_id")
    .eq("change_event_id", changeId);

  if (exErr) throw new Error(exErr.message);

  const haveCount = new Map<string, number>();
  for (const a of existing ?? []) {
    const role = String((a as { approval_area?: string }).approval_area ?? "General");
    haveCount.set(role, (haveCount.get(role) ?? 0) + 1);
  }

  const { data: members, error: memErr } = await supabase
    .from("organization_members")
    .select("user_id, role, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  if (memErr) throw new Error(memErr.message);

  const adminPool = (members ?? [])
    .filter((m) => String((m as { role?: string }).role ?? "") === "admin")
    .map((m) => (m as { user_id: string }).user_id);

  const anyonePool = (members ?? []).map((m) => (m as { user_id: string }).user_id);

  // Phase 3: use explicit org role assignments for routing (DOMAIN_REVIEWER, RISK_OWNER, EXEC, ...)
  const { data: roleRows, error: roleErr } = await supabase
    .from("organization_member_roles")
    .select("user_id, role_key, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  if (roleErr) throw new Error(roleErr.message);

  const byRoleKey = new Map<string, string[]>();
  for (const r of roleRows ?? []) {
    const roleKey = String((r as { role_key?: string }).role_key ?? "");
    const uid = String((r as { user_id?: string }).user_id ?? "");
    if (!roleKey || !uid) continue;
    const arr = byRoleKey.get(roleKey) ?? [];
    if (!arr.includes(uid)) arr.push(uid);
    byRoleKey.set(roleKey, arr);
  }

  function pick(role: string, count: number): string[] {
    const pool = (byRoleKey.get(role)?.length ?? 0) > 0
      ? (byRoleKey.get(role) ?? [])
      : adminPool.length > 0
        ? adminPool
        : anyonePool;
    return pool.slice(0, count);
  }

  const inserts: {
    change_event_id: string;
    org_id: string;
    domain: string;
    approver_user_id: string;
    approval_area: string;
    decision: string;
    comment: null;
    decided_at: null;
  }[] = [];
  for (const r of required) {
    const have = haveCount.get(r.role) ?? 0;
    const need = Math.max(0, r.min - have);
    if (need <= 0) continue;

    const approvers = pick(r.role, need);
    for (const uid of approvers) {
      inserts.push({
        change_event_id: changeId,
        org_id: orgId,
        domain,
        approver_user_id: uid,
        approval_area: r.role,
        decision: "PENDING",
        comment: null,
        decided_at: null,
      });
    }
  }

  if (inserts.length === 0) return { inserted: 0 };

  const { error: insErr } = await supabase.from("approvals").insert(inserts);
  if (insErr) throw new Error(insErr.message);

  return { inserted: inserts.length };
}
