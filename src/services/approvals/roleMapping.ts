import type { SupabaseClient } from "@supabase/supabase-js";

export type MappingTriggerType = "DOMAIN" | "SYSTEM" | "CHANGE_TYPE";

export type ApprovalRoleMember = {
  userId: string;
  email: string | null;
  name: string | null;
};

export type ApprovalRoleSuggestion = {
  roleId: string;
  roleName: string;
  priority: number;
  matchedBy: Array<{ triggerType: MappingTriggerType; triggerValue: string }>;
  members: ApprovalRoleMember[];
};

export type ApprovalRoleSuggestionResult = {
  suggestions: ApprovalRoleSuggestion[];
  suggestedUserIds: string[];
  warnings: string[];
};

function norm(v: string) {
  return v.trim().toLowerCase();
}

function matches(
  triggerType: MappingTriggerType,
  triggerValue: string,
  ctx: { domain: string; systems: string[]; changeType: string | null }
) {
  const tv = norm(triggerValue);
  if (triggerType === "DOMAIN") return norm(ctx.domain) === tv;
  if (triggerType === "SYSTEM") return ctx.systems.map(norm).includes(tv);
  return norm(ctx.changeType ?? "") === tv;
}

export async function resolveApprovalRoleSuggestions(
  admin: SupabaseClient,
  args: {
    orgId: string;
    domain: string;
    systems: string[];
    changeType: string | null;
  }
): Promise<ApprovalRoleSuggestionResult> {
  const { orgId, domain, systems, changeType } = args;

  const { data: mappings, error: mapErr } = await admin
    .from("approval_mappings")
    .select("id, trigger_type, trigger_value, approval_role_id, priority, enabled")
    .eq("org_id", orgId)
    .eq("enabled", true)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });

  if (mapErr) throw new Error(mapErr.message);

  const matched = (mappings ?? []).filter((m) =>
    matches(m.trigger_type as MappingTriggerType, m.trigger_value as string, {
      domain,
      systems,
      changeType,
    })
  );

  if (matched.length === 0) {
    return { suggestions: [], suggestedUserIds: [], warnings: [] };
  }

  const roleIds = [...new Set(matched.map((m) => String(m.approval_role_id)))];
  const { data: roles, error: roleErr } = await admin
    .from("approval_roles")
    .select("id, role_name, enabled")
    .eq("org_id", orgId)
    .in("id", roleIds)
    .eq("enabled", true);
  if (roleErr) throw new Error(roleErr.message);

  const roleById = new Map(
    (roles ?? []).map((r) => [String(r.id), { id: String(r.id), roleName: String(r.role_name) }])
  );

  const { data: roleMembers, error: rmErr } = await admin
    .from("approval_role_members")
    .select("role_id, user_id")
    .eq("org_id", orgId)
    .in("role_id", roleIds);
  if (rmErr) throw new Error(rmErr.message);

  const memberIds = [...new Set((roleMembers ?? []).map((r) => String(r.user_id)))];
  const { data: domainPerms } = memberIds.length
    ? await admin
        .from("user_domain_permissions")
        .select("user_id, can_review")
        .eq("org_id", orgId)
        .eq("domain", domain)
        .in("user_id", memberIds)
    : { data: [] as Array<{ user_id: string; can_review: boolean | null }> };
  const canReviewByUserId = new Map<string, boolean>(
    (domainPerms ?? []).map((p) => [String(p.user_id), Boolean(p.can_review)])
  );
  const userDetails = new Map<string, { email: string | null; name: string | null }>();
  for (const uid of memberIds) {
    try {
      const { data } = await (admin as SupabaseClient).auth.admin.getUserById(uid);
      const u = data.user;
      userDetails.set(uid, {
        email: u?.email ?? null,
        name:
          ((u?.user_metadata as Record<string, unknown> | undefined)?.full_name as string) ??
          ((u?.user_metadata as Record<string, unknown> | undefined)?.name as string) ??
          null,
      });
    } catch {
      userDetails.set(uid, { email: null, name: null });
    }
  }

  const membersByRole = new Map<string, ApprovalRoleMember[]>();
  for (const rm of roleMembers ?? []) {
    const roleId = String(rm.role_id);
    const userId = String(rm.user_id);
    const arr = membersByRole.get(roleId) ?? [];
    const detail = userDetails.get(userId) ?? { email: null, name: null };
    if (canReviewByUserId.has(userId) && !canReviewByUserId.get(userId)) {
      continue;
    }
    if (!arr.some((x) => x.userId === userId)) {
      arr.push({ userId, email: detail.email, name: detail.name });
    }
    membersByRole.set(roleId, arr);
  }

  const grouped = new Map<
    string,
    {
      roleId: string;
      roleName: string;
      priority: number;
      matchedBy: Array<{ triggerType: MappingTriggerType; triggerValue: string }>;
    }
  >();

  for (const m of matched) {
    const roleId = String(m.approval_role_id);
    const role = roleById.get(roleId);
    if (!role) continue;
    const existing = grouped.get(roleId);
    if (!existing) {
      grouped.set(roleId, {
        roleId,
        roleName: role.roleName,
        priority: Number(m.priority ?? 100),
        matchedBy: [
          {
            triggerType: m.trigger_type as MappingTriggerType,
            triggerValue: String(m.trigger_value),
          },
        ],
      });
    } else {
      existing.priority = Math.max(existing.priority, Number(m.priority ?? 100));
      existing.matchedBy.push({
        triggerType: m.trigger_type as MappingTriggerType,
        triggerValue: String(m.trigger_value),
      });
      grouped.set(roleId, existing);
    }
  }

  const warnings: string[] = [];
  for (const uid of memberIds) {
    if (canReviewByUserId.has(uid) && !canReviewByUserId.get(uid)) {
      const display = userDetails.get(uid)?.email ?? uid;
      warnings.push(`User "${display}" lacks domain review permission for ${domain}.`);
    }
  }
  const suggestions: ApprovalRoleSuggestion[] = Array.from(grouped.values())
    .map((g) => {
      const members = membersByRole.get(g.roleId) ?? [];
      if (members.length === 0) warnings.push(`Role "${g.roleName}" has no members.`);
      return {
        roleId: g.roleId,
        roleName: g.roleName,
        priority: g.priority,
        matchedBy: g.matchedBy,
        members,
      };
    })
    .sort((a, b) => b.priority - a.priority || a.roleName.localeCompare(b.roleName));

  const suggestedUserIds = [...new Set(suggestions.flatMap((s) => s.members.map((m) => m.userId)))];
  return { suggestions, suggestedUserIds, warnings };
}

export async function applyApprovalRoleSuggestions(
  admin: SupabaseClient,
  args: {
    orgId: string;
    changeId: string;
    domain: string;
    suggestions: ApprovalRoleSuggestion[];
  }
): Promise<{ inserted: number }> {
  const { orgId, changeId, domain, suggestions } = args;

  const { data: existing, error: exErr } = await admin
    .from("approvals")
    .select("approver_user_id, approval_area")
    .eq("change_event_id", changeId);
  if (exErr) throw new Error(exErr.message);

  const existingKeys = new Set(
    (existing ?? []).map(
      (r) => `${String(r.approver_user_id)}::${String(r.approval_area ?? "")}`
    )
  );

  const inserts: Array<{
    change_event_id: string;
    org_id: string;
    domain: string;
    approver_user_id: string;
    approval_area: string;
    decision: "PENDING";
    comment: null;
    decided_at: null;
  }> = [];

  for (const suggestion of suggestions) {
    for (const member of suggestion.members) {
      const key = `${member.userId}::${suggestion.roleName}`;
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      inserts.push({
        change_event_id: changeId,
        org_id: orgId,
        domain,
        approver_user_id: member.userId,
        approval_area: suggestion.roleName,
        decision: "PENDING",
        comment: null,
        decided_at: null,
      });
    }
  }

  if (inserts.length === 0) return { inserted: 0 };
  const { error: insErr } = await admin.from("approvals").insert(inserts);
  if (insErr) throw new Error(insErr.message);
  return { inserted: inserts.length };
}
