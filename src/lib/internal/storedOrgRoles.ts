/** Stored organization member / invite roles (same allowlist as customer org flows). */
export const STORED_ORG_ROLES = ["owner", "admin", "reviewer", "submitter", "viewer"] as const;

export type StoredOrgRole = (typeof STORED_ORG_ROLES)[number];

export function isStoredOrgRole(r: string): r is StoredOrgRole {
  return (STORED_ORG_ROLES as readonly string[]).includes(r);
}
