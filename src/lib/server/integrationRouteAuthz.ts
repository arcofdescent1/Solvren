/**
 * Canonical authz for integration HTTP routes (verified user + org permission).
 */
import { parseRequestedOrgId, requireOrgPermission, type AuthzContext } from "@/lib/server/authz";

export async function requireIntegrationsViewForOrg(orgIdRaw: string | null | undefined): Promise<AuthzContext> {
  const orgId = parseRequestedOrgId(orgIdRaw);
  return requireOrgPermission(orgId, "integrations.view");
}

export async function requireIntegrationsManageForOrg(orgIdRaw: string | null | undefined): Promise<AuthzContext> {
  const orgId = parseRequestedOrgId(orgIdRaw);
  return requireOrgPermission(orgId, "integrations.manage");
}
