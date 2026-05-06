/**
 * Phase 4 — wrapper for /api/internal/* handlers: verified internal session + active employee profile.
 */
import type { NextRequest } from "next/server";
import { requireInternalEmployeeApi, type InternalEmployeeContext } from "@/lib/internal/auth";

export type InternalHandlerContext = InternalEmployeeContext;

export async function withEmployeeAccess(
  _req: NextRequest,
  handler: (ctx: InternalHandlerContext) => Promise<Response>,
): Promise<Response> {
  const gate = await requireInternalEmployeeApi();
  if (!gate.ok) return gate.response;

  return handler(gate.ctx);
}
