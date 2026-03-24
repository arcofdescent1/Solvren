import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse } from "@/lib/server/authz";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createPrivilegedClient } from "@/lib/server/adminClient";
import { getPurgeRun, updatePurgeRun } from "@/modules/org-purge/org-purge.repository";
import { verifyOrgPurge } from "@/modules/org-purge/org-purge-verifier.service";
import { requireOrgPurgeRunAccess } from "@/modules/org-purge/org-purge-authz.server";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: runId } = await ctx.params;
    const admin = createPrivilegedClient("org-purge:verify");
    const { data: run, error } = await getPurgeRun(admin, runId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const orgId = String(run.target_org_id);
    const supabase = await createServerSupabaseClient();
    const { userId } = await requireOrgPurgeRunAccess({
      supabase,
      admin,
      requestId: String(run.request_id),
      targetOrgId: orgId,
    });

    const result = await verifyOrgPurge(admin, orgId);

    await updatePurgeRun(admin, runId, {
      verification_json: { ...result, verifiedByUserId: userId } as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ verification: result });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
