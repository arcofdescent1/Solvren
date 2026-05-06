import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPrivilegedClient } from "@/lib/server/adminClient";
import { assertOrgOwnerOrAdmin, authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { parsePrivacyMode } from "@/lib/server/privacy/privacy-policy";

const bodySchema = z.object({
  orgId: z.string().uuid(),
  privacyMode: z.enum(["minimal", "expanded"]),
  expandedFinancialDetailEnabled: z.boolean().optional(),
});

/**
 * POST /api/org/security/privacy-mode — owner/admin; expanded→minimal queues downgrade job.
 */
export async function POST(req: NextRequest) {
  try {
    const json = bodySchema.parse(await req.json());
    const orgId = parseRequestedOrgId(json.orgId);
    const ctx = await requireOrgPermission(orgId, "org.settings.manage");
    assertOrgOwnerOrAdmin(ctx);

    const admin = createPrivilegedClient("org privacy_mode update");
    const { data: prev } = await admin
      .from("organizations")
      .select("privacy_mode, privacy_policy_version")
      .eq("id", orgId)
      .maybeSingle();

    const previousMode = parsePrivacyMode((prev as { privacy_mode?: string } | null)?.privacy_mode);
    const nextMode = json.privacyMode;

    const patch: Record<string, unknown> = {
      privacy_mode: nextMode,
      privacy_policy_version: "p5-v1",
    };
    if (json.expandedFinancialDetailEnabled !== undefined) {
      patch.expanded_financial_detail_enabled = json.expandedFinancialDetailEnabled;
    }

    const { error: upErr } = await admin.from("organizations").update(patch).eq("id", orgId);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    if (previousMode === "expanded" && nextMode === "minimal") {
      await admin.from("org_privacy_jobs").insert({
        org_id: orgId,
        job_type: "downgrade_to_minimal",
        status: "queued",
      });
      await admin
        .from("issue_impact_summaries")
        .update({ computed_under_privacy_mode: "expanded" })
        .eq("org_id", orgId);
    }

    return NextResponse.json({ ok: true, privacyMode: nextMode });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return authzErrorResponse(e);
  }
}
