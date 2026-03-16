/**
 * Process a single GitHub webhook event.
 * Handles installation, installation_repositories, pull_request, push.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { GitHubClient } from "./GitHubClient";
import {
  syncInstallation,
  syncRepositories,
} from "./GitHubInstallationService";
import {
  runDetection,
  createChangeFromPr,
} from "./GitHubDetectionService";
import { DEFAULT_FILE_PATH_RULES } from "./constants";
import { env } from "@/lib/env";

type WebhookEvent = {
  id: string;
  org_id: string | null;
  github_delivery_id: string;
  github_event: string;
  github_installation_id: number | null;
  github_repository_id: number | null;
  payload: Record<string, unknown>;
};

export async function processWebhookEvent(
  admin: SupabaseClient,
  event: WebhookEvent
): Promise<{ ok: boolean; error?: string }> {
  const { github_event: evt, github_installation_id: instId, github_repository_id: repoId, payload } = event;

  try {
    if (evt === "installation" || evt === "installation_repositories") {
      const action = payload.action as string;
      const installation = payload.installation as { id?: number; account?: { login?: string; type?: string } };
      if (!installation?.id) return { ok: true };
      let targetOrgId: string | null = event.org_id;
      if (!targetOrgId) {
        const { data: inst } = await admin
          .from("github_installations")
          .select("org_id")
          .eq("github_installation_id", installation.id)
          .maybeSingle();
        targetOrgId = (inst as { org_id?: string })?.org_id ?? null;
      }
      if (!targetOrgId) return { ok: true }; // New install not yet in our DB; callback will handle
      if (action === "created" || action === "deleted") {
        if (action === "deleted") {
          await admin
            .from("integration_connections")
            .update({ status: "disconnected" })
            .eq("org_id", targetOrgId)
            .eq("provider", "github");
        } else {
          await syncInstallation(
            admin,
            targetOrgId,
            installation.id,
            installation.account?.login ?? "unknown",
            installation.account?.type === "Organization" ? "Organization" : "User"
          );
          await syncRepositories(admin, targetOrgId, installation.id);
        }
      }
      if (evt === "installation_repositories" && action === "added") {
        await syncRepositories(admin, targetOrgId, installation.id);
      }
      return { ok: true };
    }

    if ((evt === "pull_request" || evt === "push") && instId && repoId) {
      const orgId = event.org_id;
      if (!orgId) return { ok: true };

      let { data: cfg } = await admin
        .from("github_repo_configs")
        .select("*")
        .eq("org_id", orgId)
        .eq("github_repository_id", repoId)
        .maybeSingle();

      if (!cfg) {
        await admin.from("github_repo_configs").insert({
          org_id: orgId,
          github_repository_id: repoId,
          enabled: true,
          auto_create_change_from_pr: true,
          auto_detect_push_changes: true,
          status_checks_enabled: true,
        });
        const { data: inserted } = await admin
          .from("github_repo_configs")
          .select("*")
          .eq("org_id", orgId)
          .eq("github_repository_id", repoId)
          .single();
        cfg = inserted;
      }

      const config = cfg as {
        enabled?: boolean;
        auto_create_change_from_pr?: boolean;
        auto_detect_push_changes?: boolean;
        status_checks_enabled?: boolean;
        file_path_rules?: unknown;
      } | null;
      if (!config || config.enabled === false) return { ok: true };

      const rules = Array.isArray(config.file_path_rules) && config.file_path_rules.length > 0
        ? (config.file_path_rules as Array<{ pattern: string; domain: string; riskWeight: number }>)
        : DEFAULT_FILE_PATH_RULES;

      if (evt === "pull_request") {
        const pr = payload.pull_request as { id?: number; number?: number; head?: { sha?: string; ref?: string; repo?: { full_name?: string } }; base?: { ref?: string }; user?: { login?: string }; title?: string };
        const repo = payload.repository as { full_name?: string };
        const action = payload.action as string;
        if (!["opened", "reopened", "synchronize"].includes(action)) return { ok: true };
        if (!config.auto_create_change_from_pr || !pr?.id) return { ok: true };

        const client = new GitHubClient(instId);
        const [owner, repoName] = (repo?.full_name ?? "").split("/");
        const files = await client.getPullRequestFiles(owner, repoName ?? "", pr.number ?? 0);
        const filePaths = files.map((f) => f.filename);

        const detection = runDetection({
          admin,
          orgId,
          githubRepositoryId: repoId,
          filePaths,
          rules,
          sourceType: "pull_request",
          sourceId: String(pr.id),
        });

        if (!detection.detected) return { ok: true };

        const { data: existingLink } = await admin
          .from("github_pull_request_links")
          .select("change_id")
          .eq("org_id", orgId)
          .eq("github_pr_id", pr.id)
          .maybeSingle();

        let changeId: string;
        const existing = existingLink as { change_id?: string } | null;
        if (existing?.change_id) {
          changeId = existing.change_id;
          await admin.from("github_detection_events").insert({
            org_id: orgId,
            github_repository_id: repoId,
            source_type: "pull_request",
            source_id: String(pr.id),
            change_id: changeId,
            detected_domain: detection.domain,
            detected_files: detection.matchedFiles,
            detected_risk_score: detection.riskScore,
            detection_reason: { matchedRules: detection.reasons },
          });
        } else {
          changeId = await createChangeFromPr({
            admin,
            orgId,
            githubRepositoryId: repoId,
            prNumber: pr.number ?? 0,
            prId: pr.id,
            headSha: pr.head?.sha ?? "",
            baseRef: pr.base?.ref ?? "",
            headRef: pr.head?.ref ?? "",
            title: pr.title ?? "",
            authorLogin: pr.user?.login,
            fullName: repo?.full_name ?? "",
            detection,
            changedFiles: filePaths,
          });
        }

        const statusChecks = config?.status_checks_enabled !== false;
        if (statusChecks && pr.head?.sha) {
          const baseUrl = env.appUrl.replace(/\/$/, "");
          const targetUrl = `${baseUrl}/changes/${changeId}`;
          const context = env.githubDefaultStatusContext;
          try {
            await client.createCommitStatus(
              owner,
              repoName ?? "",
              pr.head.sha,
              "pending",
              context,
              "Governance review required",
              targetUrl
            );
          } catch {
            // non-fatal
          }
        }
      }

      if (evt === "push") {
        if (!config.auto_detect_push_changes) return { ok: true };
        const push = payload as { commits?: Array<{ added?: string[]; removed?: string[]; modified?: string[] }>; repository?: { full_name?: string } };
        const commits = push.commits ?? [];
        const filePaths = new Set<string>();
        for (const c of commits) {
          for (const p of [...(c.added ?? []), ...(c.removed ?? []), ...(c.modified ?? [])]) {
            filePaths.add(p);
          }
        }
        const paths = Array.from(filePaths);
        if (paths.length === 0) return { ok: true };
        const detection = runDetection({
          admin,
          orgId,
          githubRepositoryId: repoId,
          filePaths: paths,
          rules,
          sourceType: "push",
          sourceId: (payload as { after?: string }).after ?? "",
        });
        if (!detection.detected) return { ok: true };
        await admin.from("github_detection_events").insert({
          org_id: orgId,
          github_repository_id: repoId,
          source_type: "push",
          source_id: (payload as { after?: string }).after ?? "",
          detected_domain: detection.domain,
          detected_files: detection.matchedFiles,
          detected_risk_score: detection.riskScore,
          detection_reason: { matchedRules: detection.reasons },
        });
      }

      return { ok: true };
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
