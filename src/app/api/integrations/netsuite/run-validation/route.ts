import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { NetSuiteClient } from "@/services/netsuite/NetSuiteClient";
import { auditLog } from "@/lib/audit";
import { revealCredentialTokenFields } from "@/lib/server/integrationTokenFields";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  try {
    if (!env.netsuiteIntegrationEnabled) return NextResponse.json({ error: "NetSuite not configured" }, { status: 503 });

    let body: { changeId?: string; templateIds?: string[]; parameters?: Record<string, unknown>; organizationId?: string };
    try { body = (await req.json()) as typeof body; } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
    const orgId = req.nextUrl.searchParams.get("orgId") ?? body.organizationId;
    if (!orgId) return NextResponse.json({ error: "organizationId required" }, { status: 400 });

    const ctx = await requireOrgPermission(parseRequestedOrgId(orgId), "integrations.manage");
    const admin = createAdminClient();

    const templateIds = body.templateIds ?? [];
    if (templateIds.length === 0) return NextResponse.json({ error: "templateIds required" }, { status: 400 });

    const { data: account } = await admin.from("netsuite_accounts").select("id, account_id").eq("org_id", ctx.orgId).maybeSingle();
    const { data: credsRaw } = await admin.from("integration_credentials").select("client_id, client_secret").eq("org_id", ctx.orgId).eq("provider", "netsuite").maybeSingle();
    const creds = credsRaw ? revealCredentialTokenFields(credsRaw as Record<string, unknown>) : null;
    if (!account || !creds || !(creds as { client_id?: string }).client_id || !(creds as { client_secret?: string }).client_secret) {
      return NextResponse.json({ error: "NetSuite not connected" }, { status: 400 });
    }

    const client = new NetSuiteClient({
      accountId: (account as { account_id: string }).account_id,
      clientId: (creds as { client_id: string }).client_id,
      clientSecret: (creds as { client_secret: string }).client_secret,
    });

    const runIds: string[] = [];
    for (const templateId of templateIds) {
      const { data: tmpl } = await admin.from("netsuite_validation_templates").select("query_text, template_type, enabled").eq("id", templateId).eq("org_id", ctx.orgId).maybeSingle();
      const t = tmpl as { query_text?: string; enabled?: boolean } | null;
      if (!t || t.enabled === false) continue;

      const { data: run } = await admin
        .from("netsuite_validation_runs")
        .insert({
          org_id: ctx.orgId,
          change_id: body.changeId ?? null,
          template_id: templateId,
          netsuite_account_id: (account as { id: string }).id,
          status: "running",
          input_parameters: body.parameters ?? {},
        })
        .select("id")
        .single();

      if (!run) continue;
      runIds.push((run as { id: string }).id);

      let status: "succeeded" | "failed" | "threshold_breached" = "succeeded";
      let resultSummary: Record<string, unknown> = {};
      let errorMessage: string | null = null;

      try {
        const q = t.query_text;
        if (!q) throw new Error("No query text");
        const res = await client.executeSuiteQL(q);
        resultSummary = { itemCount: res.items.length, totalResults: res.totalResults };
      } catch (e) {
        status = "failed";
        errorMessage = e instanceof Error ? e.message : String(e);
      }

      await admin
        .from("netsuite_validation_runs")
        .update({ status, result_summary: resultSummary, error_message: errorMessage, finished_at: new Date().toISOString() })
        .eq("id", (run as { id: string }).id);
    }

    await auditLog(ctx.supabase, { orgId: ctx.orgId, actorId: ctx.user.id, actorType: "USER", action: "netsuite.validation.run.completed", entityType: "change", entityId: body.changeId ?? undefined, metadata: { runIds } });
    return NextResponse.json({ runIds });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
