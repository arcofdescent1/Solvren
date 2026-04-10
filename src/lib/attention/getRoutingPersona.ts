import type { OrgRole } from "@/lib/rbac/roles";
import type { RoutingPersona } from "./types";

const PRIORITY: Record<RoutingPersona, number> = {
  EXECUTIVE: 6,
  SENIOR_TECH_LEADER: 5,
  DEPARTMENT_LEADER: 4,
  OPERATOR: 3,
  SUBMITTER: 2,
  WATCHER: 1,
};

function personaFromKeys(roleKeysUpper: string[]): RoutingPersona | null {
  const keys = new Set(roleKeysUpper.map((k) => k.toUpperCase()));
  if (keys.has("EXEC") || keys.has("CEO") || keys.has("COO") || keys.has("CRO")) {
    return "EXECUTIVE";
  }
  if (keys.has("VP_TECH") || keys.has("CTO")) {
    return "SENIOR_TECH_LEADER";
  }
  if (keys.has("DEPARTMENT_LEADER")) {
    return "DEPARTMENT_LEADER";
  }
  return null;
}

function personaFromOrgRole(role: OrgRole): RoutingPersona {
  if (role === "OWNER") return "EXECUTIVE";
  if (role === "ADMIN") return "OPERATOR";
  if (role === "REVIEWER") return "OPERATOR";
  if (role === "SUBMITTER") return "SUBMITTER";
  return "WATCHER";
}

/**
 * Phase 2 routing persona — deterministic from org role + organization_member_roles.role_key only.
 */
export function getRoutingPersona(args: {
  orgRole: OrgRole;
  roleKeysUpper: string[];
}): RoutingPersona {
  const fromKeys = personaFromKeys(args.roleKeysUpper);
  const fromRole = personaFromOrgRole(args.orgRole);
  const candidates: RoutingPersona[] = [];
  if (fromKeys) candidates.push(fromKeys);
  candidates.push(fromRole);
  let best: RoutingPersona = "WATCHER";
  let bestP = -1;
  for (const p of candidates) {
    const pr = PRIORITY[p];
    if (pr > bestP) {
      best = p;
      bestP = pr;
    }
  }
  return best;
}
