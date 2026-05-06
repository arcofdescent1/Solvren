/**
 * POST /api/customer/security/support-access/revoke — org admin revokes active grant.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({
  orgId: z.string().uuid(),
  grantId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    let body: z.infer<typeof Body>;
    try {
      body = Body.parse(await req.json());
    } catch {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const ctx = await requireOrgPermission(parseRequestedOrgId(body.orgId), "org.settings.manage");
    const supabase = await createServerSupabaseClient();

    const revokedAt = new Date().toISOString();
    const { data: grant, error: gErr } = await supabase
      .from("customer_access_grants")
      .select("id, status")
      .eq("id", body.grantId)
      .eq("org_id", ctx.orgId)
      .maybeSingle();

    if (gErr || !grant) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if ((grant as { status: string }).status !== "approved") {
      return NextResponse.json({ error: "Grant is not active" }, { status: 400 });
    }

    const { error: uErr } = await supabase
      .from("customer_access_grants")
      .update({
        status: "revoked",
        revoked_at: revokedAt,
      })
      .eq("id", body.grantId)
      .eq("org_id", ctx.orgId);

    if (uErr) {
      console.error("[support-access revoke]", uErr.message);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
