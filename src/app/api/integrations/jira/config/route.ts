import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { auditLog } from "@/lib/audit";
import { registerJiraWebhooks } from "@/services/jira/jiraWebhookService";
import { RG_CHANGE_STATUS_SET } from "@/lib/changes/statuses";
const SITE_URL_RE = /^https:\/\/[a-z0-9-]+\.atlassian\.net\/?$/;

type JiraConfig = {
  cloudId?: string;
  siteUrl?: string;
  siteName?: string;
  enabled?: boolean;
  projects?: string[];
  issueTypes?: string[];
  fieldMappings?: Record<string, string>;
  statusMappings?: Record<string, string>;
  features?: {
    webhookSync?: boolean;
    issuePropertySync?: boolean;
    commentSync?: boolean;
    workflowBlocking?: boolean;
  };
};

function validateConfig(config: Partial<JiraConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (config.siteUrl && !SITE_URL_RE.test(config.siteUrl)) {
    errors.push("siteUrl must match https://*.atlassian.net");
  }
  const projects = config.projects;
  if (projects !== undefined && (!Array.isArray(projects) || projects.length === 0)) {
    errors.push("projects must contain at least one project key");
  }
  const statusMappings = config.statusMappings;
  if (statusMappings && typeof statusMappings === "object") {
    for (const [, rgStatus] of Object.entries(statusMappings)) {
      const s = String(rgStatus).toUpperCase();
      if (!RG_CHANGE_STATUS_SET.has(s)) {
        errors.push("Invalid RG status in statusMappings: " + rgStatus);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: conn } = await admin
    .from("integration_connections")
    .select("status, config, last_error, last_success_at, health_status")
    .eq("org_id", orgId)
    .eq("provider", "jira")
    .maybeSingle();

  const c = conn as {
    status?: string;
    config?: JiraConfig;
    last_error?: string;
    last_success_at?: string;
    health_status?: string;
  } | null;

  return NextResponse.json({
    connected: c?.status === "connected",
    config: c?.config ?? null,
    lastError: c?.last_error ?? null,
    lastSuccessAt: c?.last_success_at ?? null,
    healthStatus: c?.health_status ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member || !isAdminLikeRole(parseOrgRole((member as { role?: string }).role ?? null))) {
    return NextResponse.json({ error: "Admin required" }, { status: 403 });
  }

  const { data: conn } = await admin
    .from("integration_connections")
    .select("id, status, config")
    .eq("org_id", orgId)
    .eq("provider", "jira")
    .maybeSingle();

  const existing = conn as { id?: string; status?: string; config?: JiraConfig } | null;
  const canEdit = existing?.status === "connected" || existing?.status === "configured";
  if (!existing || !canEdit) {
    return NextResponse.json(
      { error: "Jira not connected for this organization" },
      { status: 400 }
    );
  }

  let body: Partial<JiraConfig>;
  try {
    body = (await req.json()) as Partial<JiraConfig>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { valid, errors } = validateConfig(body);
  if (!valid) {
    return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 });
  }

  const merged: JiraConfig = {
    ...(existing.config ?? {}),
    ...body,
    cloudId: body.cloudId ?? existing.config?.cloudId,
    siteUrl: body.siteUrl ?? existing.config?.siteUrl,
    siteName: body.siteName ?? existing.config?.siteName,
  };

  const { error } = await admin
    .from("integration_connections")
    .update({
      config: merged,
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("provider", "jira");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (merged.features?.webhookSync && merged.cloudId && merged.projects?.length) {
    const connId = existing.id ?? "";
    await registerJiraWebhooks(
      admin,
      orgId,
      connId,
      merged.cloudId,
      merged.projects
    );
  }

  await auditLog(supabase, {
    orgId,
    actorId: userRes.user.id,
    actorType: "USER",
    action: "jira.config.updated",
    entityType: "integration",
    entityId: "jira",
    metadata: { projects: merged.projects, enabled: merged.enabled },
  });

  return NextResponse.json({ success: true });
}
