import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import { decryptSecret } from "@/lib/server/crypto";
import { verifySolvrenWebhookSignature } from "@/lib/customSources/webhookSignature";
import { allowCustomSourceRequest } from "@/lib/customSources/sourceRateLimit";
import { mapWebhookPayload } from "@/lib/customSources/mapWebhookPayload";
import { parseIntakeRecordType } from "@/lib/intake/intakeMapping";
import { createIntakeChange } from "@/lib/intake/createIntakeChange";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ webhookPathKey: string }> }
) {
  const rawBody = await req.text();
  const { webhookPathKey } = await ctx.params;
  const admin = createAdminClient();

  const { data: source, error } = await admin
    .from("custom_sources")
    .select("*")
    .eq("webhook_path_key", webhookPathKey)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (error || !source) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const src = source as {
    id: string;
    org_id: string;
    webhook_secret_ciphertext: string;
    webhook_secret_previous_ciphertext: string | null;
    mapping_config_json: unknown;
    default_intake_record_type: string | null;
    rate_limit_per_minute: number;
    ip_allowlist_cidr: string[] | null;
  };

  if (!allowCustomSourceRequest(src.id, src.rate_limit_per_minute ?? 60)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const sig = req.headers.get("X-Solvren-Signature");
  let activeSecret: string;
  let prevSecret: string | null = null;
  try {
    activeSecret = decryptSecret(src.webhook_secret_ciphertext);
    if (src.webhook_secret_previous_ciphertext) {
      try {
        prevSecret = decryptSecret(src.webhook_secret_previous_ciphertext);
      } catch {
        prevSecret = null;
      }
    }
  } catch {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const okSig =
    verifySolvrenWebhookSignature(rawBody, sig, activeSecret) ||
    (prevSecret ? verifySolvrenWebhookSignature(rawBody, sig, prevSecret) : false);
  if (!okSig) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const defaultType = parseIntakeRecordType(src.default_intake_record_type ?? "OTHER");
  const mapped = mapWebhookPayload(body, src.mapping_config_json, defaultType);
  if (!mapped.title) {
    return NextResponse.json({ error: "Missing title" }, { status: 400 });
  }

  async function resolveActorUserIdForOrg(): Promise<string | null> {
    const { data: row } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("org_id", src.org_id)
      .in("role", ["owner", "admin"])
      .limit(1)
      .maybeSingle();
    if (row?.user_id) return row.user_id as string;
    const { data: anyRow } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("org_id", src.org_id)
      .limit(1)
      .maybeSingle();
    return (anyRow?.user_id as string) ?? null;
  }

  if (mapped.externalRecordId) {
    const { data: existingLink } = await admin
      .from("custom_source_external_records")
      .select("change_event_id")
      .eq("custom_source_id", src.id)
      .eq("external_record_id", mapped.externalRecordId)
      .maybeSingle();

    if (existingLink?.change_event_id) {
      const changeId = existingLink.change_event_id as string;
      const { error: u1 } = await admin
        .from("change_events")
        .update({
          title: mapped.title.slice(0, 500),
          intake: { description: mapped.description },
          source_reference: mapped.externalRecordId,
          intake_metadata_json: body as object,
        })
        .eq("id", changeId);

      if (u1) return NextResponse.json({ error: u1.message }, { status: 500 });

      await auditLog(admin, {
        orgId: src.org_id,
        actorType: "SYSTEM",
        action: "WEBHOOK_RECORD_RECEIVED",
        entityType: "custom_source",
        entityId: src.id,
        changeEventId: changeId,
        metadata: { external_record_id: mapped.externalRecordId, updated: true },
      });

      const { data: latestIa } = await admin
        .from("impact_assessments")
        .select("id")
        .eq("change_event_id", changeId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestIa?.id) {
        const { mapUserSeverityToRiskBucket } = await import("@/lib/intake/intakeMapping");
        await admin
          .from("impact_assessments")
          .update({ risk_bucket: mapUserSeverityToRiskBucket(mapped.severity) })
          .eq("id", latestIa.id as string);
      }

      return NextResponse.json({ ok: true, updated: true, changeEventId: changeId });
    }
  }

  const actorUserId = await resolveActorUserIdForOrg();
  if (!actorUserId) {
    return NextResponse.json({ error: "Organization has no members" }, { status: 500 });
  }

  const { changeEventId } = await createIntakeChange({
    supabase: admin,
    orgId: src.org_id,
    actorUserId,
    actorEmail: null,
    title: mapped.title,
    description: mapped.description,
    intakeRecordType: mapped.intakeRecordType,
    sourceMode: "CUSTOM",
    sourceLabel: `Custom source ${src.id}`,
    sourceReference: mapped.externalRecordId,
    intakeMetadataJson: { payload: body },
    severity: mapped.severity,
    timelineEventType: "CUSTOM_SOURCE_RECORD_INGESTED",
    timelineTitle: "Custom source record",
    timelineDescription: mapped.externalRecordId
      ? `Ingested external id ${mapped.externalRecordId}`
      : "Ingested webhook payload",
    timelineMetadata: { custom_source_id: src.id },
    auditAction: "WEBHOOK_RECORD_RECEIVED",
  });

  if (mapped.externalRecordId) {
    await admin.from("custom_source_external_records").insert({
      custom_source_id: src.id,
      external_record_id: mapped.externalRecordId,
      change_event_id: changeEventId,
    });
  }

  return NextResponse.json({ ok: true, created: true, changeEventId });
}
