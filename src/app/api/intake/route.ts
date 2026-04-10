import { NextResponse } from "next/server";
import { z } from "zod";
import {
  authzErrorResponse,
  parseRequestedOrgId,
  requireOrgMembership,
} from "@/lib/server/authz";
import { assertCanCreateManualIntake } from "@/lib/server/intakeAuthz";
import { createIntakeChange } from "@/lib/intake/createIntakeChange";
import { submitChangeDelegated } from "@/lib/intake/submitChangeDelegated";
import { parseIntakeRecordType } from "@/lib/intake/intakeMapping";

const bodySchema = z.object({
  orgId: z.string().uuid(),
  intakeRecordType: z.string().optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(20000).optional(),
  severity: z.string().max(32).optional(),
  submitMode: z.enum(["DRAFT", "ACTIVE"]),
  sourceLabel: z.string().max(500).optional(),
  sourceReference: z.string().max(500).optional(),
  intakeMetadataJson: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  try {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const orgId = parseRequestedOrgId(parsed.data.orgId);
    const ctx = await requireOrgMembership(orgId);
    assertCanCreateManualIntake(ctx.role);

    const intakeRecordType = parseIntakeRecordType(parsed.data.intakeRecordType);
    const cookie = req.headers.get("cookie") ?? "";

    const { changeEventId } = await createIntakeChange({
      supabase: ctx.supabase,
      orgId,
      actorUserId: ctx.user.id,
      actorEmail: ctx.user.email ?? null,
      title: parsed.data.title,
      description: parsed.data.description,
      intakeRecordType,
      sourceMode: "MANUAL",
      sourceLabel: parsed.data.sourceLabel ?? null,
      sourceReference: parsed.data.sourceReference ?? null,
      intakeMetadataJson: (parsed.data.intakeMetadataJson ?? {}) as Record<string, unknown>,
      severity: parsed.data.severity,
      timelineEventType: "MANUAL_INTAKE_CREATED",
      timelineTitle: "Manual intake",
      timelineDescription: "Intake created from manual form",
      timelineMetadata: {},
      auditAction: "MANUAL_INTAKE_CREATED",
    });

    if (parsed.data.submitMode === "ACTIVE") {
      const sub = await submitChangeDelegated({
        requestUrl: req.url,
        cookieHeader: cookie,
        changeEventId,
      });
      if (!sub.ok && sub.status !== 202) {
        const msg =
          sub.json &&
          typeof sub.json === "object" &&
          "error" in sub.json &&
          typeof (sub.json as { error?: unknown }).error === "string"
            ? (sub.json as { error: string }).error
            : "Submit failed";
        return NextResponse.json(
          { ok: false, changeEventId, error: msg, submitStatus: sub.status },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      changeEventId,
      submitMode: parsed.data.submitMode,
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
