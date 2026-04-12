/**
 * Phase 3 — executive user heuristics (membership role, department, title).
 */
import { parseOrgRole, type OrgRole } from "@/lib/rbac/roles";

export function isExecutiveMembership(args: {
  role: string | null | undefined;
  department: string | null | undefined;
  title: string | null | undefined;
}): boolean {
  const orgRole: OrgRole = parseOrgRole(args.role);
  if (orgRole === "OWNER" || orgRole === "ADMIN") return true;
  const d = (args.department ?? "").trim();
  if (d === "Leadership") return true;
  const t = (args.title ?? "").toUpperCase();
  const needles = ["CEO", "COO", "CFO", "VP", "HEAD OF"];
  if (needles.some((n) => t.includes(n))) return true;
  return false;
}
