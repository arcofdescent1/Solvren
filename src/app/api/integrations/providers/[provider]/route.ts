/**
 * Phase 1 — GET /api/integrations/providers/:provider (§15.1).
 */
import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission, resolveDefaultOrgForUser } from "@/lib/server/authz";
import { getProviderManifest } from "@/modules/integrations/registry/getProviderManifest";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const orgIdRaw = req.nextUrl.searchParams.get("orgId");
    const ctx = orgIdRaw
      ? await requireOrgPermission(parseRequestedOrgId(orgIdRaw), "integrations.view")
      : await resolveDefaultOrgForUser();

    const { provider } = await params;
  const manifest = getProviderManifest(provider);
  if (!manifest) {
    return NextResponse.json(
      { ok: false, error: { code: "not_found", message: "Unknown provider" } },
      { status: 404 }
    );
  }
    return NextResponse.json({
      ok: true,
      data: manifest,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
