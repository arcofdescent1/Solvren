/**
 * Resolve Solvren role from IdP groups/claims
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedIdentity } from "./claimMapper";

export type StoredOrgRole = "owner" | "admin" | "reviewer" | "submitter" | "viewer" | "approver";

export async function resolveRoleFromMappings(
  db: SupabaseClient,
  providerId: string,
  identity: NormalizedIdentity,
  defaultRole?: StoredOrgRole
): Promise<StoredOrgRole> {
  const { data: mappings } = await db
    .from("sso_role_mappings")
    .select("mapping_type, source_key, source_value, target_role, priority")
    .eq("provider_id", providerId)
    .order("priority", { ascending: true });

  const rows = (mappings ?? []) as Array<{
    mapping_type: string;
    source_key: string | null;
    source_value: string | null;
    target_role: string;
    priority: number;
  }>;

  for (const m of rows) {
    if (m.mapping_type === "default" && m.source_value === "*") {
      return mapToStoredRole(m.target_role);
    }
    if (m.mapping_type === "group" && m.source_key === "group") {
      if (identity.groups.includes(m.source_value ?? "")) {
        return mapToStoredRole(m.target_role);
      }
    }
    if (m.mapping_type === "claim" && m.source_key) {
      const claimVal = (identity.rawClaims as Record<string, unknown>)[m.source_key];
      const s = m.source_value ?? "";
      if (String(claimVal ?? "") === s) {
        return mapToStoredRole(m.target_role);
      }
    }
    if (m.mapping_type === "email_domain" && m.source_value) {
      const domain = identity.email.split("@")[1] ?? "";
      if (domain.toLowerCase() === (m.source_value as string).toLowerCase()) {
        return mapToStoredRole(m.target_role);
      }
    }
  }

  if (defaultRole) return mapToStoredRole(defaultRole);
  return "viewer";
}

function mapToStoredRole(target: string): StoredOrgRole {
  const r = String(target).toLowerCase();
  if (r === "approver") return "reviewer"; // org membership uses reviewer
  if (["owner", "admin", "reviewer", "submitter", "viewer"].includes(r)) {
    return r as StoredOrgRole;
  }
  return "viewer";
}
