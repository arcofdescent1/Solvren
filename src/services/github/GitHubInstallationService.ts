/**
 * GitHub installation and repository sync.
 * Upserts github_installations, integration_connections, github_repositories.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { GitHubClient } from "./GitHubClient";

export async function syncInstallation(
  admin: SupabaseClient,
  orgId: string,
  installationId: number,
  accountLogin: string,
  accountType: "User" | "Organization"
): Promise<{ installationRowId: string; connectionId: string }> {
  // Upsert integration_connections for github
  const { data: conn, error: connErr } = await admin
    .from("integration_connections")
    .upsert(
      {
        org_id: orgId,
        provider: "github",
        status: "connected",
        config: { installationId, accountLogin, accountType },
      },
      { onConflict: "org_id,provider" }
    )
    .select("id")
    .single();

  if (connErr || !conn) {
    throw new Error(connErr?.message ?? "Failed to upsert integration_connection");
  }

  const connectionId = (conn as { id: string }).id;

  const { data: inst, error: instErr } = await admin
    .from("github_installations")
    .upsert(
      {
        org_id: orgId,
        integration_connection_id: connectionId,
        github_installation_id: installationId,
        github_account_login: accountLogin,
        github_account_type: accountType,
      },
      { onConflict: "org_id,github_installation_id" }
    )
    .select("id")
    .single();

  if (instErr || !inst) {
    throw new Error(instErr?.message ?? "Failed to upsert github_installation");
  }

  const installationRowId = (inst as { id: string }).id;
  return { installationRowId, connectionId };
}

export async function syncRepositories(
  admin: SupabaseClient,
  orgId: string,
  installationId: number
): Promise<void> {
  const client = new GitHubClient(installationId);
  const repos = await client.getRepos();

  for (const repo of repos) {
    const [ownerLogin, repoName] = repo.full_name.split("/");
    await admin
      .from("github_repositories")
      .upsert(
        {
          org_id: orgId,
          github_installation_id: installationId,
          github_repository_id: repo.id,
          owner_login: ownerLogin ?? null,
          repo_name: repoName ?? null,
          full_name: repo.full_name,
          default_branch: repo.default_branch ?? "main",
          private: repo.private ?? false,
          active: true,
        },
        { onConflict: "org_id,github_repository_id" }
      );
  }
}
