import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPrivilegedClient } from "@/lib/server/adminClient";
import { assertOrgOwnerOrAdmin, authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";

const bodySchema = z.object({
  orgId: z.string().uuid(),
  writeBackEnabled: z.boolean(),
});

/**
 * POST /api/org/security/write-back — owner/admin toggles external mutation allowlist.
 */
export async function POST(req: NextRequest) {
  try {
    const json = bodySchema.parse(await req.json());
    const orgId = parseRequestedOrgId(json.orgId);
    const ctx = await requireOrgPermission(orgId, "org.settings.manage");
    assertOrgOwnerOrAdmin(ctx);

    const admin = createPrivilegedClient("org write_back_enabled update");
    const { error } = await admin
      .from("organizations")
      .update({ write_back_enabled: json.writeBackEnabled })
      .eq("id", orgId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, writeBackEnabled: json.writeBackEnabled });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return authzErrorResponse(e);
  }
}
