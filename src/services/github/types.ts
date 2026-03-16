/**
 * GitHub IES (Integration Engineering Specification) types.
 * Used by GitHub App auth, webhook handling, and detection.
 */

// ---------------------------------------------------------------------------
// Installation & Repository
// ---------------------------------------------------------------------------

export type GitHubInstallation = {
  id: string;
  org_id: string;
  integration_connection_id: string | null;
  github_installation_id: number;
  github_account_login: string | null;
  github_account_type: "User" | "Organization" | null;
  app_slug: string | null;
  installation_target_id: number | null;
  suspended_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GitHubRepository = {
  id: string;
  org_id: string;
  github_installation_id: number;
  github_repository_id: number;
  owner_login: string | null;
  repo_name: string | null;
  full_name: string | null;
  default_branch: string | null;
  private: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type GitHubRepoConfig = {
  id: string;
  org_id: string;
  github_repository_id: number;
  enabled: boolean;
  auto_create_change_from_pr: boolean;
  auto_detect_push_changes: boolean;
  status_checks_enabled: boolean;
  pr_comment_sync_enabled: boolean;
  default_domain: string | null;
  file_path_rules: FilePathRule[];
  branch_rules: BranchRules;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Detection Rules
// ---------------------------------------------------------------------------

export type FilePathRule = {
  /** Glob pattern, e.g. pricing-prefix or path-contains-revrec. */
  pattern: string;
  /** Domain label (e.g. revenue, billing). */
  domain: string;
  /** Risk weight 0-100. */
  riskWeight: number;
};

export type BranchRules = {
  /** Branch names or patterns to include. Empty = all. */
  include?: string[];
  /** Branch names or patterns to exclude. */
  exclude?: string[];
};

// ---------------------------------------------------------------------------
// Webhook Payloads
// ---------------------------------------------------------------------------

export type GitHubWebhookPayloadInstallation = {
  action: "created" | "deleted" | "suspend" | "unsuspend" | "new_permissions_accepted";
  installation: {
    id: number;
    account: { login: string; type: "User" | "Organization"; avatar_url?: string };
    app_slug?: string;
    target_id?: number;
    suspended_at?: string | null;
  };
  repositories?: Array<{ id: number; full_name: string; private?: boolean }>;
  repository_selection?: "all" | "selected";
};

export type GitHubWebhookPayloadInstallationRepositories = {
  action: "added" | "removed";
  installation: {
    id: number;
    account: { login: string; type: "User" | "Organization" };
    app_slug?: string;
    target_id?: number;
  };
  repository_selection: "all" | "selected";
  repositories_added?: Array<{ id: number; full_name: string; default_branch?: string; private?: boolean }>;
  repositories_removed?: Array<{ id: number; full_name: string }>;
};

export type GitHubWebhookPayloadPullRequest = {
  action: string;
  number: number;
  pull_request: {
    id: number;
    number: number;
    state: string;
    head: { sha: string; ref: string; repo: { id: number; full_name: string } };
    base: { ref: string; repo: { id: number; full_name: string } };
    user?: { login: string };
  };
  repository: {
    id: number;
    full_name: string;
    owner: { login: string };
    name: string;
    default_branch?: string;
    private?: boolean;
  };
  installation?: { id: number };
};

export type GitHubWebhookPayloadPush = {
  ref: string;
  before: string;
  after: string;
  repository: {
    id: number;
    full_name: string;
    owner: { login: string };
    name: string;
    default_branch?: string;
    private?: boolean;
  };
  installation?: { id: number };
  pusher?: { name: string; email?: string };
  commits?: Array<{ id: string; message: string; added: string[]; removed: string[]; modified: string[] }>;
};

// ---------------------------------------------------------------------------
// Detection Results
// ---------------------------------------------------------------------------

export type DetectionResult = {
  detected: boolean;
  domain: string | null;
  riskScore: number;
  matchedFiles: string[];
  reasons: DetectionReason[];
};

export type DetectionReason = {
  rule: string;
  domain: string;
  riskWeight: number;
  files: string[];
};
