import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authzErrorResponse, requireOrgPermission } from "@/lib/server/authz";
import { createPrivilegedClient } from "@/lib/server/adminClient";
import { getPurgeRequest, getPurgeRun, insertPurgeRun } from "@/modules/org-purge/org-purge.repository";
import { evaluateOrgPurgeRetention } from "@/modules/org-purge/org-purge-retention-evaluator.service";
import { executeOrgPurgeRun } from "@/modules/org-purge/org-purge-executor.service";
import { auditLog } from "@/lib/audit";

const bodySchema = z.object({
  resumeRunId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: requestId } = await ctx.params;
    const body = bodySchema.parse(await req.json().catch(() => ({})));
    const admin = createPrivilegedClient("org-purge:execute");
    const { data: reqRow, error } = await getPurgeRequest(admin, requestId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!reqRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const auth = await requireOrgPermission(reqRow.target_org_id, "domains.manage");

    if (reqRow.status !== "approved") {
      return NextResponse.json({ error: `Execute requires approved request (got ${reqRow.status})` }, { status: 409 });
    }

    const retention = evaluateOrgPurgeRetention({ legalHoldActive: reqRow.legal_hold_active });
    if (retention.blocked) {
      return NextResponse.json({ error: retention.message }, { status: 409 });
    }

    if (reqRow.scheduled_execute_at) {
      const t = Date.parse(reqRow.scheduled_execute_at);
      if (!Number.isNaN(t) && t > Date.now()) {
        return NextResponse.json({ error: "scheduled_execute_at is in the future" }, { status: 409 });
      }
    }

    let runId = body.resumeRunId ?? null;
    if (runId) {
      const { data: existingRun, error: runErr } = await getPurgeRun(admin, runId);
      if (runErr || !existingRun) return NextResponse.json({ error: "Run not found" }, { status: 404 });
      if (String(existingRun.request_id) !== requestId) {
        return NextResponse.json({ error: "Run does not belong to this request" }, { status: 400 });
      }
      if (String(existingRun.target_org_id) !== reqRow.target_org_id) {
        return NextResponse.json({ error: "Run org mismatch" }, { status: 400 });
      }
    } else {
      const ins = await insertPurgeRun(admin, {
        request_id: requestId,
        target_org_id: reqRow.target_org_id,
        status: "pending",
        actor_user_id: auth.user.id,
      });
      if (ins.error || !ins.data) {
        return NextResponse.json({ error: ins.error?.message ?? "Failed to create run" }, { status: 500 });
      }
      runId = ins.data.id;
    }

    await auditLog(admin, {
      orgId: reqRow.target_org_id,
      actorId: auth.user.id,
      action: "org.purge.started",
      entityType: "org_purge_run",
      entityId: runId,
      metadata: { request_id: requestId, resume: Boolean(body.resumeRunId) },
    });

    const exec = await executeOrgPurgeRun({
      admin,
      runId: runId!,
      orgId: reqRow.target_org_id,
      actorUserId: auth.user.id,
    });

    if (!exec.ok) {
      await auditLog(admin, {
        orgId: reqRow.target_org_id,
        actorId: auth.user.id,
        action: "org.purge.failed",
        entityType: "org_purge_run",
        entityId: runId!,
        metadata: { failed_step: exec.failedStep, message: exec.message },
      });
      return NextResponse.json(
        { ok: false, runId, failedStep: exec.failedStep, message: exec.message },
        { status: 500 }
      );
    }

    // Do not append audit_log rows after successful purge (audit_log for the org is deleted; outcome is in org_purge_runs).

    return NextResponse.json({ ok: true, runId });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: e.message }, { status: 400 });
    return authzErrorResponse(e);
  }
}
