import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { getAccountById } from "@/modules/integrations/core/integrationAccountsRepo";
import { integrationScopesResponse } from "@/lib/server/integrations/integrationScopeCatalog";
import { getOrgPrivacySettings } from "@/lib/server/privacy/org-privacy";

/**
 * GET /api/integrations/accounts/:integrationAccountId/scopes
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ integrationAccountId: string }> }
) {
  try {
    const { integrationAccountId } = await params;
    const client = await createServerSupabaseClient();

    const { data: account, error: accErr } = await getAccountById(client, integrationAccountId);
    if (accErr || !account) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const orgId = parseRequestedOrgId(account.org_id);
    const ctx = await requireOrgPermission(orgId, "integrations.view");

    const settings = await getOrgPrivacySettings(ctx.supabase, orgId);
    const privacyMode = settings?.privacyMode ?? "minimal";
    const writeBackEnabled = settings?.writeBackEnabled ?? false;

    const granted = account.scopes_granted_json?.length ? account.scopes_granted_json : null;

    return NextResponse.json(
      integrationScopesResponse({
        provider: account.provider,
        writeBackEnabled,
        privacyMode,
        requestedScopes: granted,
      })
    );
  } catch (e) {
    return authzErrorResponse(e);
  }
}
