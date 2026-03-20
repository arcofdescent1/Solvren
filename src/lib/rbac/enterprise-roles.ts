/**
 * Phase 6 — Enterprise RBAC personas (D1) mapped onto legacy `organization_members.role`.
 * Legacy values: owner | admin | reviewer | submitter | viewer (see migration 109).
 */
export type EnterprisePersona = "admin" | "operator" | "viewer" | "executive";

export function legacyOrgRoleToEnterprise(
  role: string | null | undefined
): EnterprisePersona {
  const r = (role ?? "viewer").toLowerCase().trim();
  if (r === "owner" || r === "admin") return "admin";
  if (r === "submitter") return "operator";
  if (r === "reviewer") return "executive";
  return "viewer";
}

export function enterpriseCanEnqueueJobs(persona: EnterprisePersona): boolean {
  return persona === "admin" || persona === "operator";
}

export function enterpriseCanManageIntegrations(persona: EnterprisePersona): boolean {
  return persona === "admin" || persona === "operator";
}

export function enterpriseCanViewAuditLog(persona: EnterprisePersona): boolean {
  return persona === "admin" || persona === "executive";
}
