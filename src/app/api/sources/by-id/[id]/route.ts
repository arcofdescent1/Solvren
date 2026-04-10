import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import { encryptSecret } from "@/lib/server/crypto";
import {
  authzErrorResponse,
  parseRequestedOrgId,
  requireOrgMembership,
} from "@/lib/server/authz";
import { assertCanManageCustomSources } from "@/lib/server/intakeAuthz";

const patchSchema = z.object({
  orgId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ERROR"]).optional(),
  mapping_config_json: z.record(z.string(), z.unknown()).optional(),
  default_intake_record_type: z.string().nullable().optional(),
  rate_limit_per_minute: z.number().int().min(1).max(600).optional(),
  ip_allowlist_cidr: z.array(z.string()).nullable().optional(),
  rotateSecret: z.boolean().optional(),
});

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const url = new URL(req.url);
    const orgId = parseRequestedOrgId(url.searchParams.get("orgId"));
    const session = await requireOrgMembership(orgId);
    assertCanManageCustomSources(session.role);

    const { id } = await ctx.params;
    const admin = createAdminClient();
    const { data: row, error } = await admin
      .from("custom_sources")
      .select(
        "id, org_id, name, input_method, status, webhook_path_key, mapping_config_json, default_intake_record_type, rate_limit_per_minute, ip_allowlist_cidr, created_at, updated_at"
      )
      .eq("id", id)
      .maybeSingle();

    if (error || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if ((row as { org_id: string }).org_id !== orgId)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const base = new URL(req.url).origin;
    const webhookPathKey = (row as { webhook_path_key: string }).webhook_path_key;
    const webhookUrl = `${base}/api/public/sources/${webhookPathKey}/ingest`;

    return NextResponse.json({
      ok: true,
      source: { ...row, webhookUrl },
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = patchSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const orgId = parseRequestedOrgId(parsed.data.orgId);
    const session = await requireOrgMembership(orgId);
    assertCanManageCustomSources(session.role);

    const { id } = await ctx.params;
    const admin = createAdminClient();
    const { data: existing, error: exErr } = await admin
      .from("custom_sources")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (exErr || !existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if ((existing as { org_id: string }).org_id !== orgId)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim();
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;
    if (parsed.data.mapping_config_json !== undefined) {
      updates.mapping_config_json = parsed.data.mapping_config_json;
    }
    if (parsed.data.default_intake_record_type !== undefined) {
      updates.default_intake_record_type = parsed.data.default_intake_record_type;
    }
    if (parsed.data.rate_limit_per_minute !== undefined) {
      updates.rate_limit_per_minute = parsed.data.rate_limit_per_minute;
    }
    if (parsed.data.ip_allowlist_cidr !== undefined) {
      updates.ip_allowlist_cidr = parsed.data.ip_allowlist_cidr;
    }

    let newSecretPlain: string | undefined;
    if (parsed.data.rotateSecret) {
      newSecretPlain = randomBytes(32).toString("hex");
      const prev = (existing as { webhook_secret_ciphertext: string }).webhook_secret_ciphertext;
      updates.webhook_secret_previous_ciphertext = prev;
      updates.webhook_secret_ciphertext = encryptSecret(newSecretPlain);
      await auditLog(admin, {
        orgId,
        actorId: session.user.id,
        action: "SOURCE_SECRET_ROTATED",
        entityType: "custom_source",
        entityId: id,
        metadata: {},
      });
    }

    const { error: upErr } = await admin.from("custom_sources").update(updates).eq("id", id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    if (parsed.data.mapping_config_json !== undefined) {
      await auditLog(admin, {
        orgId,
        actorId: session.user.id,
        action: "SOURCE_UPDATED",
        entityType: "custom_source",
        entityId: id,
        metadata: { section: "mapping" },
      });
    } else {
      await auditLog(admin, {
        orgId,
        actorId: session.user.id,
        action: "SOURCE_UPDATED",
        entityType: "custom_source",
        entityId: id,
        metadata: {},
      });
    }

    return NextResponse.json({
      ok: true,
      ...(newSecretPlain ? { secretPlaintext: newSecretPlain } : {}),
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const url = new URL(req.url);
    const orgId = parseRequestedOrgId(url.searchParams.get("orgId"));
    const session = await requireOrgMembership(orgId);
    assertCanManageCustomSources(session.role);

    const { id } = await ctx.params;
    const admin = createAdminClient();
    const { data: existing } = await admin.from("custom_sources").select("org_id").eq("id", id).maybeSingle();
    if (!existing || (existing as { org_id: string }).org_id !== orgId)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { error } = await admin.from("custom_sources").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await auditLog(admin, {
      orgId,
      actorId: session.user.id,
      action: "SOURCE_UPDATED",
      entityType: "custom_source",
      entityId: id,
      metadata: { deleted: true },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
