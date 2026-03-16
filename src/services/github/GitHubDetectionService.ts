/**
 * GitHub detection: apply path rules, create/update Changes, link PRs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { matchFilePath } from "./detectionRules";
import { DEFAULT_FILE_PATH_RULES } from "./constants";
import type { FilePathRule } from "./types";

const DOMAIN_MAP: Record<string, string> = {
  revenue: "REVENUE",
  billing: "REVENUE",
  pricing: "REVENUE",
  revrec: "REVENUE",
  data: "DATA",
  workflow: "WORKFLOW",
  security: "SECURITY",
};

function mapToChangeDomain(domain: string): string {
  return DOMAIN_MAP[domain?.toLowerCase() ?? ""] ?? "REVENUE";
}

export type RunDetectionParams = {
  admin: SupabaseClient;
  orgId: string;
  githubRepositoryId: number;
  filePaths: string[];
  rules?: FilePathRule[];
  sourceType: "pull_request" | "push";
  sourceId: string;
};

export type RunDetectionResult = {
  detected: boolean;
  domain: string | null;
  riskScore: number;
  matchedFiles: string[];
  reasons: Array<{ pattern: string; domain: string; riskWeight: number; files: string[] }>;
};

export function runDetection(params: RunDetectionParams): RunDetectionResult {
  const { filePaths, rules = DEFAULT_FILE_PATH_RULES } = params;
  const matchedFiles: string[] = [];
  const reasons: RunDetectionResult["reasons"] = [];
  let maxRisk = 0;
  let detectedDomain: string | null = null;

  for (const path of filePaths) {
    const { matched, matchedFiles: mf } = matchFilePath(path, rules);
    if (matched.length > 0) {
      matchedFiles.push(path);
      for (const r of matched) {
        maxRisk = Math.max(maxRisk, r.riskWeight);
        detectedDomain = detectedDomain ?? r.domain;
        const existing = reasons.find((x) => x.pattern === r.pattern);
        if (existing) {
          if (!existing.files.includes(path)) existing.files.push(path);
        } else {
          reasons.push({ pattern: r.pattern, domain: r.domain, riskWeight: r.riskWeight, files: [path] });
        }
      }
    }
  }

  return {
    detected: matchedFiles.length > 0,
    domain: detectedDomain,
    riskScore: maxRisk,
    matchedFiles: [...new Set(matchedFiles)],
    reasons,
  };
}

export async function createChangeFromPr(params: {
  admin: SupabaseClient;
  orgId: string;
  githubRepositoryId: number;
  prNumber: number;
  prId: number;
  headSha: string;
  baseRef: string;
  headRef: string;
  title: string;
  authorLogin?: string;
  fullName: string;
  detection: RunDetectionResult;
  changedFiles: string[];
}): Promise<string> {
  const {
    admin,
    orgId,
    githubRepositoryId,
    prNumber,
    prId,
    headSha,
    baseRef,
    headRef,
    title,
    authorLogin,
    fullName,
    detection,
  } = params;

  const changeTitle = `GitHub PR #${prNumber}: ${(title || "Update").slice(0, 200)}`;
  const domain = mapToChangeDomain(detection.domain ?? "revenue");

  const { data: change, error } = await admin
    .from("change_events")
    .insert({
      org_id: orgId,
      title: changeTitle,
      change_type: "OTHER",
      status: "DRAFT",
      domain,
      systems_involved: [],
      revenue_impact_areas: [],
      intake: {
        github: {
          repositoryFullName: fullName,
          prNumber,
          prId,
          headSha,
          baseRef,
          headRef,
          authorLogin,
          changedFiles: params.changedFiles,
          detectionReason: detection.reasons,
        },
      },
      created_by: null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  const changeId = (change as { id: string }).id;

  await admin.from("impact_assessments").insert({
    change_event_id: changeId,
    domain,
    status: "PENDING",
    schema_version: "pass_a_v1",
  });

  await admin.from("github_pull_request_links").insert({
    org_id: orgId,
    change_id: changeId,
    github_repository_id: githubRepositoryId,
    github_pr_number: prNumber,
    github_pr_id: prId,
    head_sha: headSha,
    base_ref: baseRef,
    head_ref: headRef,
    state: "open",
  });

  await admin.from("github_detection_events").insert({
    org_id: orgId,
    github_repository_id: githubRepositoryId,
    source_type: "pull_request",
    source_id: String(prId),
    change_id: changeId,
    detected_domain: detection.domain,
    detected_files: detection.matchedFiles,
    detected_risk_score: detection.riskScore,
    detection_reason: { matchedRules: detection.reasons },
  });

  return changeId;
}
