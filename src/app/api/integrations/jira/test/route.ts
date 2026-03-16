import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { jiraGet } from "@/lib/jira/client";
import { ensureValidJiraToken } from "@/services/jira/jiraAuthService";
import { IntegrationHealthService } from "@/modules/integrations";

export async function POST(req: NextRequest) {
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
    .select("org_id")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: conn } = await admin
    .from("integration_connections")
    .select("status, config")
    .eq("org_id", orgId)
    .eq("provider", "jira")
    .maybeSingle();

  const c = conn as {
    status?: string;
    config?: {
      cloudId?: string;
      features?: { webhookSync?: boolean; issuePropertySync?: boolean; commentSync?: boolean };
    };
  } | null;
  const isConnected = c?.status === "connected" || c?.status === "configured";
  if (!c || !isConnected || !c.config?.cloudId) {
    return NextResponse.json(
      { success: false, error: "Jira not connected or missing cloudId", checks: [] },
      { status: 400 }
    );
  }

  const creds = await ensureValidJiraToken(admin, orgId);
  if (!creds) {
    return NextResponse.json(
      { success: false, error: "No credentials found", checks: [{ name: "auth", status: "error" as const, message: "No valid credentials" }] },
      { status: 400 }
    );
  }

  const healthSvc = new IntegrationHealthService(admin);
  const checks: Array<{ name: string; status: "ok" | "warning" | "error"; message?: string }> = [];

  // auth + cloud_id + api_access
  try {
    await jiraGet<unknown>(c.config.cloudId, creds.accessToken, "/myself");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Jira API request failed";
    await healthSvc.markError(orgId, "jira", msg);
    return NextResponse.json(
      {
        success: false,
        error: msg,
        status: "error",
        checks: [
          { name: "auth", status: "error" as const, message: msg },
          { name: "cloud_id", status: "ok" as const },
          { name: "api_access", status: "error" as const, message: msg },
        ],
      },
      { status: 502 }
    );
  }

  checks.push({ name: "auth", status: "ok" });
  checks.push({ name: "cloud_id", status: "ok" });
  checks.push({ name: "api_access", status: "ok" });

  // webhook_registration when feature enabled
  if (c.config.features?.webhookSync) {
    const { data: reg } = await admin
      .from("jira_webhook_registrations")
      .select("id, status")
      .eq("org_id", orgId)
      .eq("status", "active")
      .maybeSingle();
    if (reg) {
      checks.push({ name: "webhook_registration", status: "ok" });
    } else {
      checks.push({
        name: "webhook_registration",
        status: "warning",
        message: "Webhook sync enabled but no active registration found",
      });
    }
  }

  await healthSvc.markHealthy(orgId, "jira");

  return NextResponse.json({
    success: true,
    status: "ok",
    checks,
  });
}
