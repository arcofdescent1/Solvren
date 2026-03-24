/**
 * Shared authz for /api/changes/* — verified user + change.view on the row's org (active rows only via RLS + resolveResourceInOrg).
 */
import {
  authzErrorResponse,
  resolveResourceInOrg,
  type AuthzContext,
} from "@/lib/server/authz";
import type { Permission } from "@/lib/rbac/permissions";
import { NextResponse } from "next/server";

export async function requireChangePermission(
  changeId: string,
  permission: Permission
): Promise<AuthzContext> {
  return resolveResourceInOrg({
    table: "change_events",
    resourceId: changeId,
    permission,
  });
}

export function changeAuthzError(e: unknown): NextResponse {
  return authzErrorResponse(e);
}
