import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { SalesforceClient } from "@/services/salesforce/SalesforceClient";
import { auditLog } from "@/lib/audit";
import { env } from "@/lib/env";
import { revealCredentialTokenFields } from "@/lib/server/integrationTokenFields";

export async function POST(req: NextRequest) {
  try {
    if (!env.salesforceIntegrationEnabled) return NextResponse.json({ error: "Salesforce not configured" }, { status: 503 });
    let body: { changeId?: string; templateIds?: string[]; parameters?: Record<string, unknown>; organizationId?: string };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const orgIdRaw = body.organizationId ?? req.nextUrl.searchParams.get("orgId");
    if (!orgIdRaw) return NextResponse.json({ error: "organizationId required" }, { status: 400 });
    const ctx = await requireOrgPermission(parseRequestedOrgId(orgIdRaw), "integrations.manage");
    const admin = createAdminClient();

    const templateIds = body.templateIds ?? [];
  if (templateIds.length === 0) return NextResponse.json({ error: "templateIds required" }, { status: 400 });

    const { data: sfOrg } = await admin
    .from("salesforce_orgs")
    .select("id, environment, instance_url, auth_mode")
    .eq("org_id", ctx.orgId)
    .maybeSingle();

  const { data: credsRaw } = await admin
    .from("integration_credentials")
    .select("client_id, client_secret, salesforce_username, jwt_private_key_base64")
    .eq("org_id", ctx.orgId)
    .eq("provider", "salesforce")
    .maybeSingle();

  if (!sfOrg || !credsRaw || !(credsRaw as { client_id?: string }).client_id) {
    return NextResponse.json({ error: "Salesforce not connected" }, { status: 400 });
  }

  const creds = revealCredentialTokenFields(credsRaw as Record<string, unknown>) as {
    client_id?: string;
    client_secret?: string;
    salesforce_username?: string;
    jwt_private_key_base64?: string;
  };

  const envType = (sfOrg as { environment: string }).environment as "production" | "sandbox";
  const authMode = (sfOrg as { auth_mode: string }).auth_mode as "jwt_bearer" | "client_credentials";
  const clientSecret = creds.client_secret ?? "";

  const client = new SalesforceClient({
    environment: envType,
    instanceUrl: (sfOrg as { instance_url: string }).instance_url,
    clientId: creds.client_id!,
    clientSecret,
    authMode,
    username: creds.salesforce_username ?? undefined,
    jwtPrivateKeyBase64: creds.jwt_private_key_base64 ?? undefined,
  });

  const runIds: string[] = [];
  for (const templateId of templateIds) {
    const { data: tmpl } = await admin
      .from("salesforce_validation_templates")
      .select("query_text, template_type, enabled")
      .eq("id", templateId)
      .eq("org_id", ctx.orgId)
      .maybeSingle();

    const t = tmpl as { query_text?: string; enabled?: boolean } | null;
    if (!t || t.enabled === false) continue;

    const { data: run } = await admin
      .from("salesforce_validation_runs")
      .insert({
        org_id: ctx.orgId,
        change_id: body.changeId ?? null,
        template_id: templateId,
        salesforce_org_id: (sfOrg as { id: string }).id,
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
      const res = await client.executeSoql(q);
      resultSummary = { recordCount: res.records.length, totalSize: res.totalSize };
    } catch (e) {
      status = "failed";
      errorMessage = e instanceof Error ? e.message : String(e);
    }

    await admin
      .from("salesforce_validation_runs")
      .update({ status, result_summary: resultSummary, error_message: errorMessage, finished_at: new Date().toISOString() })
      .eq("id", (run as { id: string }).id);
  }

    await auditLog(ctx.supabase, {
      orgId: ctx.orgId,
      actorId: ctx.user.id,
    actorType: "USER",
    action: "salesforce.validation.run.completed",
    entityType: "change",
    entityId: body.changeId ?? undefined,
    metadata: { runIds },
  });
    return NextResponse.json({ runIds });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
