import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse } from "@/lib/server/authz";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createPrivilegedClient } from "@/lib/server/adminClient";
import { getPurgeRun, listPurgeRunSteps } from "@/modules/org-purge/org-purge.repository";
import { requireOrgPurgeRunAccess } from "@/modules/org-purge/org-purge-authz.server";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const admin = createPrivilegedClient("org-purge:get run");
    const { data: run, error } = await getPurgeRun(admin, id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const supabase = await createServerSupabaseClient();
    await requireOrgPurgeRunAccess({
      supabase,
      admin,
      requestId: String(run.request_id),
      targetOrgId: String(run.target_org_id),
    });

    const { data: steps, error: sErr } = await listPurgeRunSteps(admin, id);
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

    return NextResponse.json({ run, steps });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
