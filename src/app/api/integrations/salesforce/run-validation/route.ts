import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SalesforceClient } from "@/services/salesforce/SalesforceClient";
import { auditLog } from "@/lib/audit";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  if (!env.salesforceIntegrationEnabled) return NextResponse.json({ error: "Salesforce not configured" }, { status: 503 });
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { changeId?: string; templateIds?: string[]; parameters?: Record<string, unknown>; organizationId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const orgId = body.organizationId ?? req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "organizationId required" }, { status: 400 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const templateIds = body.templateIds ?? [];
  if (templateIds.length === 0) return NextResponse.json({ error: "templateIds required" }, { status: 400 });

  const { data: sfOrg } = await admin
    .from("salesforce_orgs")
    .select("id, environment, instance_url, auth_mode")
    .eq("org_id", orgId)
    .maybeSingle();

  const { data: creds } = await admin
    .from("integration_credentials")
    .select("client_id, client_secret, salesforce_username, jwt_private_key_base64")
    .eq("org_id", orgId)
    .eq("provider", "salesforce")
    .maybeSingle();

  if (!sfOrg || !creds || !(creds as { client_id?: string }).client_id) {
    return NextResponse.json({ error: "Salesforce not connected" }, { status: 400 });
  }

  const envType = (sfOrg as { environment: string }).environment as "production" | "sandbox";
  const authMode = (sfOrg as { auth_mode: string }).auth_mode as "jwt_bearer" | "client_credentials";
  const clientSecret = (creds as { client_secret?: string }).client_secret ?? "";

  const client = new SalesforceClient({
    environment: envType,
    instanceUrl: (sfOrg as { instance_url: string }).instance_url,
    clientId: (creds as { client_id: string }).client_id,
    clientSecret,
    authMode,
    username: (creds as { salesforce_username?: string }).salesforce_username ?? undefined,
    jwtPrivateKeyBase64: (creds as { jwt_private_key_base64?: string }).jwt_private_key_base64 ?? undefined,
  });

  const runIds: string[] = [];
  for (const templateId of templateIds) {
    const { data: tmpl } = await admin
      .from("salesforce_validation_templates")
      .select("query_text, template_type, enabled")
      .eq("id", templateId)
      .eq("org_id", orgId)
      .maybeSingle();

    const t = tmpl as { query_text?: string; enabled?: boolean } | null;
    if (!t || t.enabled === false) continue;

    const { data: run } = await admin
      .from("salesforce_validation_runs")
      .insert({
        org_id: orgId,
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

  await auditLog(supabase, {
    orgId,
    actorId: userRes.user.id,
    actorType: "USER",
    action: "salesforce.validation.run.completed",
    entityType: "change",
    entityId: body.changeId ?? undefined,
    metadata: { runIds },
  });
  return NextResponse.json({ runIds });
}
