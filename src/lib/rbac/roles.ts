export type OrgRole = "OWNER" | "ADMIN" | "REVIEWER" | "SUBMITTER" | "VIEWER";
export type StoredOrgRole = "owner" | "admin" | "reviewer" | "submitter" | "viewer";

export function parseOrgRole(raw: string | null | undefined): OrgRole {
  const value = String(raw ?? "viewer").trim().toLowerCase();
  if (value === "owner") return "OWNER";
  if (value === "admin") return "ADMIN";
  if (value === "reviewer") return "REVIEWER";
  if (value === "submitter") return "SUBMITTER";
  return "VIEWER";
}

export function toStoredOrgRole(role: OrgRole): StoredOrgRole {
  if (role === "OWNER") return "owner";
  if (role === "ADMIN") return "admin";
  if (role === "REVIEWER") return "reviewer";
  if (role === "SUBMITTER") return "submitter";
  return "viewer";
}

export function isAdminLikeRole(role: OrgRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}
