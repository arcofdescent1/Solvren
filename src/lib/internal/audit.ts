import type { SupabaseClient } from "@supabase/supabase-js";
import type { InternalEmployeeRole } from "./employeeRoles";
import type { InternalWorkspaceTab } from "./permissions";
import { sanitizeAuditMetadata } from "@/lib/audit";

const VIEW_WINDOW_MS = 30 * 60 * 1000;

const TAB_TO_ACTION: Record<InternalWorkspaceTab, string> = {
  overview: "internal.overview.view",
  onboarding: "internal.onboarding.view",
  team_access: "internal.team_access.view",
  integrations: "internal.integrations.view",
  billing: "internal.billing.view",
  diagnostics: "internal.diagnostics.view",
  audit: "internal.audit.view",
};

export async function logInternalAudit(
  admin: SupabaseClient,
  params: {
    employeeUserId: string;
    employeeEmail: string;
    employeeRole: InternalEmployeeRole;
    orgId: string;
    action: string;
    targetType: string;
    targetId?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await admin.from("internal_admin_audit_log").insert({
    employee_user_id: params.employeeUserId,
    employee_email: params.employeeEmail.toLowerCase(),
    employee_role: params.employeeRole,
    org_id: params.orgId,
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId ?? null,
    reason: params.reason ?? null,
    metadata: sanitizeAuditMetadata(params.metadata ?? {}),
  });
  if (error) {
    console.error("[internal audit] insert failed:", error.message);
  }
}

/** Phase 2: at most one view audit per employee/org/tab per rolling 30 minutes. */
export async function maybeLogInternalTabView(
  admin: SupabaseClient,
  params: {
    employeeUserId: string;
    employeeEmail: string;
    employeeRole: InternalEmployeeRole;
    orgId: string;
    tab: InternalWorkspaceTab;
  }
): Promise<void> {
  const action = TAB_TO_ACTION[params.tab];
  const since = new Date(Date.now() - VIEW_WINDOW_MS).toISOString();
  const { data: recent } = await admin
    .from("internal_admin_audit_log")
    .select("id")
    .eq("employee_user_id", params.employeeUserId)
    .eq("org_id", params.orgId)
    .eq("action", action)
    .gte("created_at", since)
    .limit(1)
    .maybeSingle();

  if (recent) return;

  await logInternalAudit(admin, {
    ...params,
    action,
    targetType: "organization",
    targetId: params.orgId,
    metadata: { tab: params.tab },
  });
}
