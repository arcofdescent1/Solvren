import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import {
  authzErrorResponse,
  parseRequestedOrgId,
  requireOrgMembership,
} from "@/lib/server/authz";
import { assertCanManageCustomSources } from "@/lib/server/intakeAuthz";
import { encryptSecret } from "@/lib/server/crypto";

const createSchema = z.object({
  orgId: z.string().uuid(),
  name: z.string().min(1).max(200),
  inputMethod: z.enum(["JSON_WEBHOOK", "CSV_TEMPLATE", "MANUAL_UPLOAD"]).default("JSON_WEBHOOK"),
  mapping_config_json: z.record(z.string(), z.unknown()).optional(),
  default_intake_record_type: z.string().optional(),
});

function randomWebhookPathKey(): string {
  return randomBytes(24).toString("base64url").replace(/=/g, "").slice(0, 32);
}

function randomPlainSecret(): string {
  return randomBytes(32).toString("hex");
}

export async function POST(req: Request) {
  try {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = createSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const orgId = parseRequestedOrgId(parsed.data.orgId);
    const ctx = await requireOrgMembership(orgId);
    assertCanManageCustomSources(ctx.role);

    const admin = createAdminClient();
    let webhookPathKey = "";
    for (let i = 0; i < 10; i++) {
      const candidate = randomWebhookPathKey();
      const { data: clash } = await admin
        .from("custom_sources")
        .select("id")
        .eq("webhook_path_key", candidate)
        .maybeSingle();
      if (!clash) {
        webhookPathKey = candidate;
        break;
      }
    }
    if (!webhookPathKey)
      return NextResponse.json({ error: "Could not allocate webhook key" }, { status: 500 });

    const plaintextSecret = randomPlainSecret();
    const ciphertext = encryptSecret(plaintextSecret);
    const mapping = parsed.data.mapping_config_json ?? { version: 1, mappings: {} };

    const { data: row, error } = await admin
      .from("custom_sources")
      .insert({
        org_id: orgId,
        name: parsed.data.name.trim(),
        input_method: parsed.data.inputMethod,
        webhook_path_key: webhookPathKey,
        webhook_secret_ciphertext: ciphertext,
        mapping_config_json: mapping,
        default_intake_record_type: parsed.data.default_intake_record_type?.trim() || null,
        created_by_user_id: ctx.user.id,
      })
      .select("id, webhook_path_key, name")
      .single();

    if (error || !row)
      return NextResponse.json({ error: error?.message ?? "Create failed" }, { status: 500 });

    const id = (row as { id: string }).id;
    const base = new URL(req.url).origin;
    const webhookUrl = `${base}/api/public/sources/${webhookPathKey}/ingest`;

    await auditLog(admin, {
      orgId,
      actorId: ctx.user.id,
      action: "SOURCE_CREATED",
      entityType: "custom_source",
      entityId: id,
      metadata: { name: parsed.data.name.trim() },
    });

    return NextResponse.json({
      ok: true,
      source: {
        id,
        name: (row as { name: string }).name,
        webhookPathKey,
        webhookUrl,
        /** Shown once — store securely; not retrievable later. */
        secretPlaintext: plaintextSecret,
      },
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
