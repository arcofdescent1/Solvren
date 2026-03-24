/**
 * Phase 6 — Org-level learning kill switches (feature flags).
 */
import { NextResponse } from "next/server";
import { authzErrorResponse, requireOrgPermission, resolveDefaultOrgForUser } from "@/lib/server/authz";
import { auditLog } from "@/lib/audit";

export async function GET() {
  try {
    const def = await resolveDefaultOrgForUser();
    const ctx = await requireOrgPermission(def.orgId, "policy.manage");

    const { data, error } = await ctx.supabase.from("org_learning_settings").select("*").eq("org_id", ctx.orgId).maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      settings: data ?? {
        org_id: ctx.orgId,
        learning_disabled: false,
        calibration_disabled: false,
        rule_suggestions_disabled: false,
        autonomy_suggestions_disabled: false,
      },
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const def = await resolveDefaultOrgForUser();
    const ctx = await requireOrgPermission(def.orgId, "policy.manage");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
    const b = body as Record<string, unknown>;

    const patch: Record<string, boolean> = {};
    for (const key of [
      "learning_disabled",
      "calibration_disabled",
      "rule_suggestions_disabled",
      "autonomy_suggestions_disabled",
    ] as const) {
      if (typeof b[key] === "boolean") patch[key] = b[key];
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No boolean fields to update" }, { status: 400 });
    }

    const { data: before } = await ctx.supabase.from("org_learning_settings").select("*").eq("org_id", ctx.orgId).maybeSingle();

    const row = before as {
      learning_disabled?: boolean;
      calibration_disabled?: boolean;
      rule_suggestions_disabled?: boolean;
      autonomy_suggestions_disabled?: boolean;
    } | null;

    const merged = {
      org_id: ctx.orgId,
      learning_disabled: row?.learning_disabled ?? false,
      calibration_disabled: row?.calibration_disabled ?? false,
      rule_suggestions_disabled: row?.rule_suggestions_disabled ?? false,
      autonomy_suggestions_disabled: row?.autonomy_suggestions_disabled ?? false,
      ...patch,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await ctx.supabase.from("org_learning_settings").upsert(merged, { onConflict: "org_id" }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await auditLog(ctx.supabase, {
      orgId: ctx.orgId,
      actorId: ctx.user.id,
      action: "org_learning_settings_updated",
      entityType: "organization",
      entityId: ctx.orgId,
      before: before ? { ...before } : null,
      after: data ? { ...data } : null,
      metadata: { patch },
    });

    return NextResponse.json({ ok: true, settings: data });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
