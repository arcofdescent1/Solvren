/**
 * Phase 3 — POST /api/admin/signals/process. Process pending raw events.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireCronSecret } from "@/lib/cronAuth";
import { listPendingRawEvents } from "@/modules/signals/persistence/raw-events.repository";
import { processRawEvent } from "@/modules/signals/processing/signal-processor.service";
import {
  AuthzError,
  parseRequestedOrgId,
  requireAnyOrgPermission,
  requireOrgPermission,
} from "@/lib/server/authz";

export async function POST(req: NextRequest) {
  const cronOk = !requireCronSecret(req);
  const supabase = await createServerSupabaseClient();
  let body: { orgId?: string; limit?: number } = {};
  try {
    const b = await req.json();
    body = b && typeof b === "object" ? (b as { orgId?: string; limit?: number }) : {};
  } catch {
    body = {};
  }

  if (!cronOk) {
    try {
      if (body.orgId) {
        await requireOrgPermission(parseRequestedOrgId(body.orgId), "admin.jobs.view");
      } else {
        await requireAnyOrgPermission("admin.jobs.view");
      }
    } catch (e) {
      if (e instanceof AuthzError && e.status === 401) {
        return NextResponse.json(
          { ok: false, error: { code: "unauthorized", message: "Unauthorized" } },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { ok: false, error: { code: "forbidden", message: "Forbidden" } },
        { status: 403 }
      );
    }
  }

  const { data: pending, error } = await listPendingRawEvents(supabase, {
    orgId: body.orgId,
    limit: body.limit ?? 20,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: { code: "server_error", message: error.message } }, { status: 500 });
  }

  let processed = 0;
  let produced = 0;
  let failed = 0;
  for (const raw of pending) {
    const result = await processRawEvent(supabase, raw);
    processed++;
    if (result.ok) produced++;
    else failed++;
  }

  return NextResponse.json({
    ok: true,
    data: { processed, produced, failed },
    meta: { timestamp: new Date().toISOString() },
  });
}
