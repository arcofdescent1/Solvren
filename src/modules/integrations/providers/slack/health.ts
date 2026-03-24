import { createAdminClient } from "@/lib/supabase/admin";
import type { IntegrationHealthReport, TestConnectionResult } from "../../contracts/runtime";

export async function testSlackConnection(orgId: string): Promise<TestConnectionResult> {
  const admin = createAdminClient();
  const { data: install } = await admin
    .from("slack_installations")
    .select("bot_token, team_id, team_name, status")
    .eq("org_id", orgId)
    .maybeSingle();

  const row = install as { bot_token?: string; team_id?: string; team_name?: string; status?: string } | null;
  if (!row || row.status !== "ACTIVE") return { success: false, message: "Slack not connected" };
  if (!row.bot_token) return { success: false, message: "No bot token" };

  try {
    const res = await fetch("https://slack.com/api/auth.test", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${row.bot_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    if (!json.ok) return { success: false, message: json.error ?? "Auth test failed" };
    return {
      success: true,
      message: "Connected",
      details: { teamId: row.team_id ?? null, teamName: row.team_name ?? null },
    };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : "Slack auth test failed" };
  }
}

export async function getSlackHealth(orgId: string): Promise<IntegrationHealthReport> {
  const tested = await testSlackConnection(orgId);
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
