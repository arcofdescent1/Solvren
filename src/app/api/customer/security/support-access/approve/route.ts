/**
 * POST /api/customer/security/support-access/approve — org admin approves pending grant.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import {
  notifyOrgSupportAccessEvent,
  sanitizeSupportAccessReason,
} from "@/lib/server/access/support-access-notifications";
import { createPrivilegedClient } from "@/lib/server/adminClient";
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

    const approvedAt = new Date().toISOString();
    const { data: grant, error: gErr } = await supabase
      .from("customer_access_grants")
      .select("id, status, duration_hours, reason, employee_user_id")
      .eq("id", body.grantId)
      .eq("org_id", ctx.orgId)
      .maybeSingle();

    if (gErr || !grant) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const g = grant as {
      id: string;
      status: string;
      duration_hours: number;
      reason: string;
      employee_user_id: string;
    };
    if (g.status !== "pending") {
      return NextResponse.json({ error: "Grant is not pending" }, { status: 400 });
    }

    const hours = Number(g.duration_hours) || 4;
    const expires = new Date(new Date(approvedAt).getTime() + hours * 60 * 60 * 1000).toISOString();

    const { error: uErr } = await supabase
      .from("customer_access_grants")
      .update({
        status: "approved",
        approved_by_user_id: ctx.user.id,
        approved_at: approvedAt,
        starts_at: approvedAt,
        expires_at: expires,
      })
      .eq("id", g.id)
      .eq("org_id", ctx.orgId);

    if (uErr) {
      console.error("[support-access approve]", uErr.message);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    const admin = createPrivilegedClient("customer approve support access: org notification");
    await notifyOrgSupportAccessEvent(admin, ctx.orgId, {
      title: "Support access approved",
      body: `Your organization approved a support access grant. Expires at ${expires}. Reason (sanitized): ${sanitizeSupportAccessReason(g.reason)}`,
      dedupeKey: `support_access:approved:${g.id}:in_app`,
    });

    return NextResponse.json({ ok: true, grantId: g.id, expiresAt: expires });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
