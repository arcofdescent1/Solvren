/**
 * GitHub API client for installation-scoped requests.
 * Uses installation access tokens from GitHubAppAuthService.
 */

import { getInstallationToken } from "./GitHubAppAuthService";
import { env } from "@/lib/env";

const DEFAULT_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

export class GitHubClient {
  constructor(private readonly installationId: number) {}

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await getInstallationToken(this.installationId);
    return {
      ...DEFAULT_HEADERS,
      Authorization: `Bearer ${token}`,
    };
  }

  private getBaseUrl(): string {
    return env.githubApiBaseUrl.replace(/\/$/, "");
  }

  async getInstallation(): Promise<{
    id: number;
    account: { login: string; type: "User" | "Organization" };
    app_slug?: string;
    target_id?: number;
    suspended_at?: string | null;
  }> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.getBaseUrl()}/app/installations/${this.installationId}`, {
      headers,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error((data as { message?: string }).message ?? `getInstallation failed: ${res.status}`);
    }
    return data as {
      id: number;
      account: { login: string; type: "User" | "Organization" };
      app_slug?: string;
      target_id?: number;
      suspended_at?: string | null;
    };
  }

  async getRepos(): Promise<
    Array<{
      id: number;
      full_name: string;
      name: string;
      default_branch: string;
      private: boolean;
      owner: { login: string };
    }>
  > {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.getBaseUrl()}/installation/repositories?per_page=100`, {
      headers,
    });
    const data = (await res.json()) as {
      repositories?: Array<{
        id: number;
        full_name: string;
        name: string;
        default_branch: string;
        private: boolean;
        owner: { login: string };
      }>;
      message?: string;
    };
    if (!res.ok) {
      throw new Error(data.message ?? `getRepos failed: ${res.status}`);
    }
    return data.repositories ?? [];
  }

  async getPullRequestFiles(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<Array<{ filename: string }>> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(
      `${this.getBaseUrl()}/repos/${owner}/${repo}/pulls/${prNumber}/files`,
      { headers }
    );
    const data = (await res.json()) as Array<{ filename: string }> | { message?: string };
    if (!res.ok) {
      throw new Error(
        (typeof data === "object" && data !== null && "message" in data && typeof (data as { message?: string }).message === "string")
          ? (data as { message: string }).message
          : `getPullRequestFiles failed: ${res.status}`
      );
    }
    return Array.isArray(data) ? data : [];
  }

  async createCommitStatus(
    owner: string,
    repo: string,
    sha: string,
    state: "pending" | "success" | "failure" | "error",
    context: string,
    description: string | null,
    targetUrl?: string | null
  ): Promise<void> {
    const headers = await this.getAuthHeaders();
    const body: Record<string, unknown> = {
      state,
      context,
      description: description ?? undefined,
    };
    if (targetUrl) body.target_url = targetUrl;

    const res = await fetch(`${this.getBaseUrl()}/repos/${owner}/${repo}/statuses/${sha}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { message?: string };
    if (!res.ok) {
      throw new Error(data.message ?? `createCommitStatus failed: ${res.status}`);
    }
  }
}
