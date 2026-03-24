/**
 * Phase 0 — canonical server-side authorization (finalized API).
 * Order: validate input → requireUser/requireVerifiedUser → resolve org → require permission → RLS client → audit → respond.
 */
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { z } from "zod";
import { authStateFromUser, type AuthState } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Permission } from "@/lib/rbac/permissions";
import { hasPermissionInOrg } from "@/lib/rbac/can";
import type { OrgRole } from "@/lib/rbac/roles";
import { parseOrgRole } from "@/lib/rbac/roles";
import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";

export class AuthzError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 404,
    message: string
  ) {
    super(message);
    this.name = "AuthzError";
  }
}

export function authzErrorResponse(e: unknown): NextResponse {
  if (e instanceof AuthzError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  // eslint-disable-next-line no-console
  console.error("[authz] unexpected error", e);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

const uuidSchema = z.string().uuid();

export function parseRequestedOrgId(raw: string | null | undefined): string {
  const parsed = uuidSchema.safeParse(raw?.trim() ?? "");
  if (!parsed.success) {
    throw new AuthzError(400, "Invalid org id");
  }
  return parsed.data;
}

export type AwaitedServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

/** Signed-in session (org not yet resolved). */
export type SessionContext = {
  supabase: AwaitedServerClient;
  user: { id: string; email?: string | null };
  authState: AuthState;
};

/** Verified session + org membership + role (canonical contract). */
export type AuthzContext = SessionContext & {
  orgId: string;
  role: OrgRole;
};

function sessionFromUser(supabase: AwaitedServerClient, user: User): SessionContext {
  return {
    supabase,
    user: { id: user.id, email: user.email ?? null },
    authState: authStateFromUser(user),
  };
}

function toAuthzContext(session: SessionContext, orgId: string, role: OrgRole): AuthzContext {
  return { ...session, orgId, role };
}

/** Alias: authenticated user (may be unverified). */
export async function requireUser(): Promise<SessionContext> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new AuthzError(401, "Unauthorized");
  }
  return sessionFromUser(supabase, data.user);
}

/** Alias for legacy call sites. */
export const requireAuthenticatedUser = requireUser;

export async function requireVerifiedUser(): Promise<SessionContext> {
  const session = await requireUser();
  if (!session.authState.isVerified) {
    throw new AuthzError(403, "Email verification required to use this feature.");
  }
  return session;
}

async function membershipRow(
  supabase: SupabaseClient,
  userId: string,
  orgId: string
): Promise<{ role: OrgRole } | null> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  const row = data as { role?: string | null } | null;
  if (!row) return null;
  return { role: parseOrgRole(row.role ?? null) };
}

/** Membership only (no permission bitmask). */
export async function requireOrgMembership(orgId: string): Promise<AuthzContext> {
  const session = await requireVerifiedUser();
  const id = parseRequestedOrgId(orgId);
  const m = await membershipRow(session.supabase, session.user.id, id);
  if (!m) throw new AuthzError(403, "Forbidden");
  return toAuthzContext(session, id, m.role);
}

export async function requireOrgPermission(orgId: string, permission: Permission): Promise<AuthzContext> {
  const session = await requireVerifiedUser();
  const id = parseRequestedOrgId(orgId);
  const ok = await hasPermissionInOrg(session.supabase, session.user.id, id, permission);
  if (!ok) throw new AuthzError(403, "Forbidden");
  const m = await membershipRow(session.supabase, session.user.id, id);
  if (!m) throw new AuthzError(403, "Forbidden");
  return toAuthzContext(session, id, m.role);
}

/**
 * First org (by membership created_at) where the user has `permission`.
 * Use for legacy “platform admin” routes that previously scanned memberships for an admin role.
 */
export async function requireAnyOrgPermission(permission: Permission): Promise<AuthzContext> {
  const session = await requireVerifiedUser();
  const { data: rows, error } = await session.supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: true });
  if (error) {
    throw new AuthzError(404, "Not found");
  }
  for (const row of rows ?? []) {
    const orgId = String((row as { org_id: string }).org_id);
    const ok = await hasPermissionInOrg(session.supabase, session.user.id, orgId, permission);
    if (ok) {
      return toAuthzContext(
        session,
        orgId,
        parseOrgRole((row as { role?: string | null }).role ?? null)
      );
    }
  }
  throw new AuthzError(403, "Forbidden");
}

/** First org membership (legacy settings routes). Prefer explicit orgId when possible. */
export async function resolveDefaultOrgForUser(): Promise<AuthzContext> {
  const session = await requireVerifiedUser();
  const { data: row } = await session.supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const r = row as { org_id?: string; role?: string | null } | null;
  if (!r?.org_id) {
    throw new AuthzError(403, "No organization context");
  }
  return toAuthzContext(session, r.org_id, parseOrgRole(r.role ?? null));
}

/** Client-requested org: validate UUID + membership + role. */
export async function resolveRequestedOrg(orgId: string | null | undefined): Promise<AuthzContext> {
  if (orgId == null || String(orgId).trim() === "") {
    throw new AuthzError(400, "org id required");
  }
  return requireOrgMembership(orgId);
}

/** @deprecated Use resolveRequestedOrg */
export const resolveRequestedOrgAccess = async (
  requestedOrgId: string | null | undefined,
  opts?: { requireVerified?: boolean }
): Promise<AuthzContext & { orgRole: OrgRole }> => {
  const requireVerified = opts?.requireVerified !== false;
  const session = requireVerified ? await requireVerifiedUser() : await requireUser();
  const id = parseRequestedOrgId(requestedOrgId ?? "");
  const m = await membershipRow(session.supabase, session.user.id, id);
  if (!m) throw new AuthzError(403, "Forbidden");
  const base = toAuthzContext(session, id, m.role);
  return { ...base, orgRole: m.role };
};

/** @deprecated Use requireOrgMembership */
export const requireOrgAccess = requireOrgMembership;

const RESOURCE_TABLES_BY_ID = [
  "change_events",
  "issues",
  "revenue_policies",
  "approval_mappings",
  "approval_roles",
  "policies",
  "raw_events",
  "normalized_signals",
  "decision_logs",
  "autonomy_pause_controls",
  "policy_decision_logs",
  "policy_exceptions",
  "dead_letter_events",
  "integration_dead_letters",
  "integration_accounts",
  "integration_action_executions",
  "simulation_runs",
  "approval_requests",
  "detector_findings",
] as const;

export type ResourceOrgTableById = (typeof RESOURCE_TABLES_BY_ID)[number];

export type ResolveResourceInOrgArgs =
  | {
      table: ResourceOrgTableById;
      resourceId: string;
      permission: Permission;
    }
  | {
      table: "organization_settings";
      orgId: string;
      permission: Permission;
    };

/**
 * Derive org from resource row (or settings PK); then require permission.
 */
export async function resolveResourceInOrg(args: ResolveResourceInOrgArgs): Promise<AuthzContext> {
  if (args.table === "organization_settings") {
    const orgId = parseRequestedOrgId(args.orgId);
    return requireOrgPermission(orgId, args.permission);
  }
  const session = await requireVerifiedUser();
  const idParse = uuidSchema.safeParse(args.resourceId.trim());
  if (!idParse.success) {
    throw new AuthzError(400, "Invalid resource id");
  }
  const base = session.supabase.from(args.table).select("org_id").eq("id", idParse.data);
  const scoped = args.table === "change_events" ? scopeActiveChangeEvents(base) : base;
  const { data, error } = await scoped.maybeSingle();
  if (error) {
    throw new AuthzError(404, "Not found");
  }
  const row = data as { org_id?: string } | null;
  const orgId = row?.org_id;
  if (!orgId) {
    throw new AuthzError(404, "Not found");
  }
  return requireOrgPermission(orgId, args.permission);
}

/** @deprecated Use resolveResourceInOrg */
export const resolveResourceOrgAccess = resolveResourceInOrg;

/** @deprecated Use AuthzContext.role */
export type OrgAuthContext = AuthzContext & { orgRole: OrgRole };
