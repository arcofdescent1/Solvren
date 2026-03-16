import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { HubSpotClient } from "@/services/hubspot/HubSpotClient";
import { refreshAccessToken, needsRefresh } from "@/services/hubspot/HubSpotAuthService";
import { auditLog } from "@/lib/audit";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  if (!env.hubspotIntegrationEnabled) return NextResponse.json({ error: "HubSpot not configured" }, { status: 503 });
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { changeId?: string; templateIds?: string[]; parameters?: Record<string, unknown>; organizationId?: string };
  try { body = (await req.json()) as typeof body; } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const orgId = body.organizationId ?? req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "organizationId required" }, { status: 400 });

  const { data: member } = await supabase.from("organization_members").select("role").eq("org_id", orgId).eq("user_id", userRes.user.id).maybeSingle();
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const templateIds = body.templateIds ?? [];
  if (templateIds.length === 0) return NextResponse.json({ error: "templateIds required" }, { status: 400 });

  const { data: account } = await admin.from("hubspot_accounts").select("id").eq("org_id", orgId).maybeSingle();
  const { data: creds } = await admin.from("integration_credentials").select("access_token, refresh_token, expires_at, private_app_token").eq("org_id", orgId).eq("provider", "hubspot").maybeSingle();

  if (!account || !creds) return NextResponse.json({ error: "HubSpot not connected" }, { status: 400 });

  let accessToken: string;
  const refresh = (creds as { refresh_token?: string }).refresh_token;
  const token = (creds as { access_token?: string }).access_token;
  const expiresAt = (creds as { expires_at?: string })?.expires_at ?? null;
  const privateToken = (creds as { private_app_token?: string }).private_app_token;

  if (privateToken) {
    accessToken = privateToken;
  } else if (token && refresh) {
    if (needsRefresh(expiresAt)) {
      const r = await refreshAccessToken(refresh);
      accessToken = r.accessToken;
      await admin.from("integration_credentials").update({ access_token: r.accessToken }).eq("org_id", orgId).eq("provider", "hubspot");
    } else {
      accessToken = token;
    }
  } else {
    return NextResponse.json({ error: "No HubSpot credentials" }, { status: 400 });
  }

  const client = new HubSpotClient({ accessToken });
  const runIds: string[] = [];

  for (const templateId of templateIds) {
    const { data: tmpl } = await admin.from("hubspot_validation_templates").select("template_type, parameters, enabled").eq("id", templateId).eq("org_id", orgId).maybeSingle();
    const t = tmpl as { template_type?: string; parameters?: { objectType?: string; limit?: number }; enabled?: boolean } | null;
    if (!t || t.enabled === false) continue;

    const { data: run } = await admin
      .from("hubspot_validation_runs")
      .insert({ org_id: orgId, change_id: body.changeId ?? null, template_id: templateId, hubspot_account_id: (account as { id: string }).id, status: "running", input_parameters: body.parameters ?? {} })
      .select("id")
      .single();

    if (!run) continue;
    runIds.push((run as { id: string }).id);

    let status: "succeeded" | "failed" | "threshold_breached" = "succeeded";
    let resultSummary: Record<string, unknown> = {};
    let errorMessage: string | null = null;

    try {
      const objectType = t.parameters?.objectType ?? "contacts";
      const limit = t.parameters?.limit ?? 100;
      const res = await client.searchCrmObjects(objectType, { limit });
      resultSummary = { recordCount: res.results?.length ?? 0, total: res.total };
    } catch (e) {
      status = "failed";
      errorMessage = e instanceof Error ? e.message : String(e);
    }

    await admin
      .from("hubspot_validation_runs")
      .update({ status, result_summary: resultSummary, error_message: errorMessage, finished_at: new Date().toISOString() })
      .eq("id", (run as { id: string }).id);
  }

  await auditLog(supabase, { orgId, actorId: userRes.user.id, actorType: "USER", action: "hubspot.validation.run.completed", entityType: "change", entityId: body.changeId ?? undefined, metadata: { runIds } });
  return NextResponse.json({ runIds });
}
