/**
 * Phase 3 — POST /api/admin/signals/warehouse-import (§17).
 */
import { NextRequest, NextResponse } from "next/server";
import { processWarehouseImport } from "@/modules/signals/processing/warehouse-import.service";
import { createPrivilegedClient } from "@/lib/server/adminClient";
import {
  authzErrorResponse,
  parseRequestedOrgId,
  requireOrgPermission,
} from "@/lib/server/authz";

export async function POST(req: NextRequest) {
  try {
    let body: {
      orgId: string;
      rows: Array<{
        provider: string;
        objectType: string;
        externalId: string;
        eventType: string;
        eventTime: string;
        payload: Record<string, unknown>;
      }>;
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { ok: false, error: { code: "bad_request", message: "Invalid JSON" } },
        { status: 400 }
      );
    }
    if (!body.orgId || !Array.isArray(body.rows)) {
      return NextResponse.json(
        { ok: false, error: { code: "bad_request", message: "orgId and rows required" } },
        { status: 400 }
      );
    }

    const ctx = await requireOrgPermission(
      parseRequestedOrgId(body.orgId),
      "admin.jobs.view"
    );

    const rows = body.rows.slice(0, 100).map((r) => ({
      orgId: ctx.orgId,
      provider: r.provider,
      objectType: r.objectType,
      externalId: r.externalId,
      eventType: r.eventType,
      eventTime: r.eventTime,
      payload: r.payload ?? {},
    }));

    const admin = createPrivilegedClient("POST /api/admin/signals/warehouse-import");
    const result = await processWarehouseImport(admin, rows);

    return NextResponse.json({
      ok: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
