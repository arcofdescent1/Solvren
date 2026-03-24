import { createAdminClient } from "@/lib/supabase/admin";
import { jiraGet } from "@/lib/jira/client";
import { ensureValidJiraToken } from "@/services/jira/jiraAuthService";
import type { IntegrationHealthReport, TestConnectionResult } from "../../contracts/runtime";

export async function testJiraConnection(orgId: string): Promise<TestConnectionResult> {
  const admin = createAdminClient();
  const { data: conn } = await admin
    .from("integration_connections")
    .select("status, config")
    .eq("org_id", orgId)
    .eq("provider", "jira")
    .maybeSingle();

  const c = conn as { status?: string; config?: { cloudId?: string; siteName?: string } } | null;
  const cloudId = c?.config?.cloudId;
  const connected = c?.status === "connected" || c?.status === "configured";
  if (!connected || !cloudId) {
    return { success: false, message: "Jira not connected or missing cloudId" };
  }

  const creds = await ensureValidJiraToken(admin, orgId);
  if (!creds) return { success: false, message: "No valid Jira credentials found" };

  try {
    await jiraGet<unknown>(cloudId, creds.accessToken, "/myself");
    return {
      success: true,
      message: "Connected",
      details: { cloudId, siteName: c?.config?.siteName ?? null },
    };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Jira API request failed" };
  }
}

export async function getJiraHealth(orgId: string): Promise<IntegrationHealthReport> {
  const tested = await testJiraConnection(orgId);
  return {
    status: tested.success ? "healthy" : "unhealthy",
    dimensions: {
      auth: tested.success ? "healthy" : "unhealthy",
      api_reachability: tested.success ? "healthy" : "unhealthy",
      install_completeness: tested.success ? "healthy" : "degraded",
    },
    summary: tested.message,
    lastCheckedAt: new Date().toISOString(),
  };
}
