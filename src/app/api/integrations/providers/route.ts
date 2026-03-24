/**
 * Phase 1 — GET /api/integrations/providers (§15.1).
 * Returns all registered provider manifests for the Integration Control Center.
 */
import { NextResponse } from "next/server";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";
import { getAllManifests } from "@/modules/integrations/registry/getProviderManifest";

export async function GET() {
  try {
    await requireAnyOrgPermission("integrations.view");

    const manifests = getAllManifests();
    return NextResponse.json({
      ok: true,
      data: manifests,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
