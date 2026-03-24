import { createAdminClient } from "@/lib/supabase/admin";
import { GitHubClient } from "@/services/github/GitHubClient";
import type { IntegrationHealthReport, TestConnectionResult } from "../../contracts/runtime";

export async function testGitHubConnection(orgId: string): Promise<TestConnectionResult> {
  const admin = createAdminClient();
  const { data: inst } = await admin
    .from("github_installations")
    .select("github_installation_id, github_account_login")
    .eq("org_id", orgId)
    .maybeSingle();

  const row = inst as { github_installation_id?: number; github_account_login?: string | null } | null;
  if (!row?.github_installation_id) return { success: false, message: "GitHub not connected" };

  try {
    const client = new GitHubClient(row.github_installation_id);
    const installation = await client.getInstallation();
    return {
      success: true,
      message: "Connected",
      details: { installationId: row.github_installation_id, accountLogin: installation.account?.login ?? row.github_account_login ?? null },
    };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "GitHub installation check failed" };
  }
}

export async function getGitHubHealth(orgId: string): Promise<IntegrationHealthReport> {
  const tested = await testGitHubConnection(orgId);
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
