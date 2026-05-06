import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { getOrgPrivacySettings } from "@/lib/server/privacy/org-privacy";

/**
 * GET /api/org/security/data-handling-summary?orgId=
 */
export async function GET(req: NextRequest) {
  try {
    const orgIdParam = req.nextUrl.searchParams.get("orgId");
    if (!orgIdParam) return NextResponse.json({ error: "Missing orgId" }, { status: 400 });
    const orgId = parseRequestedOrgId(orgIdParam);
    const ctx = await requireOrgPermission(orgId, "org.settings.view");

    const settings = await getOrgPrivacySettings(ctx.supabase, orgId);
    if (!settings) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json({
      privacyMode: settings.privacyMode,
      writeBackEnabled: settings.writeBackEnabled,
      expandedFinancialDetailEnabled: settings.expandedFinancialDetailEnabled,
      rawPayloadStorage: "disabled_by_policy",
      piiHandling: "hash_or_redact",
      credentials: "encrypted_envelope",
      employeeAccess: "customer_controlled",
      privacyPolicyVersion: settings.privacyPolicyVersion,
      lastValidatedAt: null as string | null,
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
