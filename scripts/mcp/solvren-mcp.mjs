#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";

const SERVER_NAME = "solvren-revenue-protection";
const SERVER_VERSION = "0.4.0";
const ACTIVE_CHANGE_STATUSES = ["DRAFT", "READY", "SUBMITTED", "IN_REVIEW"];
const CLOSED_ISSUE_STATUSES = ["resolved", "verified", "dismissed"];

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    if (!existsSync(file)) continue;
    const body = readFileSync(file, "utf8");
    for (const line of body.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match || process.env[match[1]] != null) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

loadLocalEnv();

function csvEnv(name) {
  return (process.env[name] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function intEnv(name, fallback, min, max) {
  const raw = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(Math.max(Math.floor(raw), min), max);
}

const ALLOWED_ORG_IDS = (process.env.SOLVREN_MCP_ALLOWED_ORG_IDS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const ACCESS_MODE = process.env.SOLVREN_MCP_MODE ?? "readonly";
const ALLOWED_TOOLS = new Set(csvEnv("SOLVREN_MCP_ALLOWED_TOOLS"));
const MAX_LIMIT = intEnv("SOLVREN_MCP_MAX_LIMIT", 50, 1, 100);
const AUDIT_ENABLED = process.env.SOLVREN_MCP_AUDIT_ENABLED !== "false";
const CALLER_LABEL = process.env.SOLVREN_MCP_CALLER_LABEL ?? "unspecified-mcp-client";
const POLICY_PROFILE_KEY = process.env.SOLVREN_MCP_POLICY_PROFILE_KEY ?? CALLER_LABEL;
const ALLOWED_MUTATIONS = new Set(csvEnv("SOLVREN_MCP_ALLOWED_MUTATIONS"));
const REQUIRE_CONFIRMATION = process.env.SOLVREN_MCP_REQUIRE_CONFIRMATION !== "false";
const WRITE_AUDIT_REQUIRED = process.env.SOLVREN_MCP_WRITE_AUDIT_REQUIRED !== "false";
const ACTION_TTL_MINUTES = intEnv("SOLVREN_MCP_ACTION_TTL_MINUTES", 10, 1, 60);

class McpInputError extends Error {
  constructor(message, code = -32602) {
    super(message);
    this.code = code;
  }
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for Solvren MCP server.");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const supabase = getSupabase();

function jsonText(data) {
  return { content: [{ type: "text", text: JSON.stringify(redact(data), null, 2) }] };
}

function requireString(args, key) {
  const value = args?.[key];
  if (typeof value !== "string" || value.trim().length === 0) throw new McpInputError(`Missing required string: ${key}`);
  return value.trim();
}

function optionalLimit(args, fallback = 10, max = MAX_LIMIT) {
  const raw = Number(args?.limit ?? fallback);
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(Math.floor(raw), Math.min(max, MAX_LIMIT));
}

function requestIdFrom(id) {
  return id == null ? `notify-${Date.now()}` : String(id);
}

function extractOrgId(args) {
  return typeof args?.orgId === "string" && args.orgId.trim() ? args.orgId.trim() : null;
}

function assertReadOnlyMode() {
  if (ACCESS_MODE !== "readonly" && ACCESS_MODE !== "controlled_write") {
    throw new McpInputError(`Unsupported SOLVREN_MCP_MODE: ${ACCESS_MODE}. Use readonly or controlled_write.`);
  }
}

function assertToolAllowed(name) {
  if (ALLOWED_TOOLS.size > 0 && !ALLOWED_TOOLS.has(name)) {
    throw new McpInputError(`Tool is not enabled for this Solvren MCP server: ${name}`, -32601);
  }
}

function assertMutationAllowed(actionType) {
  if (ACCESS_MODE !== "controlled_write") {
    throw new McpInputError("This Solvren MCP server is running in readonly mode. Controlled writes are disabled.", -32003);
  }
  if (WRITE_AUDIT_REQUIRED && !AUDIT_ENABLED) {
    throw new McpInputError("Controlled writes require MCP audit logging to be enabled.", -32003);
  }
  if (ALLOWED_MUTATIONS.size > 0 && !ALLOWED_MUTATIONS.has(actionType)) {
    throw new McpInputError(`Mutation is not enabled for this Solvren MCP server: ${actionType}`, -32601);
  }
}

function arr(value) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function envPolicyProfile() {
  return {
    source: "environment",
    profileKey: POLICY_PROFILE_KEY,
    profileName: "Environment guardrails",
    status: "active",
    allowedTools: [...ALLOWED_TOOLS],
    allowedMutations: [...ALLOWED_MUTATIONS],
    allowedOrgIds: ALLOWED_ORG_IDS,
    maxResultLimit: MAX_LIMIT,
    allowedRoles: [],
    allowedEmailDomains: [],
    requireConfirmation: REQUIRE_CONFIRMATION,
    actionTtlMinutes: ACTION_TTL_MINUTES,
    redactionLevel: "standard",
    dataScopes: ["decisions", "problems", "proof", "setup", "audit"],
    auditLevel: "metadata",
  };
}

async function fetchCustomerPolicyProfile(orgId) {
  if (!orgId) return envPolicyProfile();
  const { data, error } = await supabase
    .from("mcp_policy_profiles")
    .select("*")
    .eq("org_id", orgId)
    .eq("profile_key", POLICY_PROFILE_KEY)
    .maybeSingle();
  if (error) {
    if (String(error.message).includes("mcp_policy_profiles")) return envPolicyProfile();
    throw new Error(error.message);
  }
  if (!data) return envPolicyProfile();
  return {
    source: "database",
    id: data.id,
    profileKey: data.profile_key,
    profileName: data.profile_name,
    status: data.status,
    purpose: data.purpose,
    allowedTools: arr(data.allowed_tools),
    allowedMutations: arr(data.allowed_mutations),
    allowedOrgIds: arr(data.allowed_org_ids),
    maxResultLimit: Number(data.max_result_limit ?? MAX_LIMIT),
    allowedRoles: arr(data.allowed_roles).map((role) => role.toLowerCase()),
    allowedEmailDomains: arr(data.allowed_email_domains).map((domain) => domain.toLowerCase()),
    requireConfirmation: Boolean(data.require_confirmation ?? true),
    actionTtlMinutes: Number(data.action_ttl_minutes ?? ACTION_TTL_MINUTES),
    redactionLevel: data.redaction_level ?? "standard",
    dataScopes: arr(data.data_scopes),
    auditLevel: data.audit_level ?? "metadata",
  };
}

function explainPolicyDecision({ allowed, reason, profile, toolName = null, actionType = null }) {
  return {
    allowed,
    reason,
    profile: {
      source: profile.source,
      id: profile.id ?? null,
      profileKey: profile.profileKey,
      profileName: profile.profileName,
      status: profile.status,
      requireConfirmation: Boolean(profile.requireConfirmation ?? REQUIRE_CONFIRMATION),
      actionTtlMinutes: Number(profile.actionTtlMinutes ?? ACTION_TTL_MINUTES),
    },
    toolName,
    actionType,
  };
}

async function effectiveToolDecision(toolName, args = {}) {
  assertToolAllowed(toolName);
  const orgId = extractOrgId(args);
  const profile = await fetchCustomerPolicyProfile(orgId);
  if (profile.status && profile.status !== "active") {
    return explainPolicyDecision({ allowed: false, reason: `MCP profile is ${profile.status}.`, profile, toolName });
  }
  if (profile.allowedOrgIds.length > 0 && orgId && !profile.allowedOrgIds.includes(orgId)) {
    return explainPolicyDecision({ allowed: false, reason: "MCP profile is not allowed for this organization.", profile, toolName });
  }
  if (profile.allowedTools.length > 0 && !profile.allowedTools.includes(toolName)) {
    return explainPolicyDecision({ allowed: false, reason: `Tool is not allowed by MCP profile: ${toolName}.`, profile, toolName });
  }
  const actor = userContext(args);
  if (actor.role && profile.allowedRoles.length > 0 && !profile.allowedRoles.includes(actor.role.toLowerCase())) {
    return explainPolicyDecision({ allowed: false, reason: `Role is not allowed by MCP profile: ${actor.role}.`, profile, toolName });
  }
  if (actor.userEmail && profile.allowedEmailDomains.length > 0) {
    const domain = actor.userEmail.split("@").at(-1) ?? "";
    if (!profile.allowedEmailDomains.includes(domain)) {
      return explainPolicyDecision({ allowed: false, reason: `Email domain is not allowed by MCP profile: ${domain}.`, profile, toolName });
    }
  }
  return explainPolicyDecision({ allowed: true, reason: "Allowed by effective MCP policy.", profile, toolName });
}

async function assertEffectiveToolAllowed(toolName, args = {}) {
  const decision = await effectiveToolDecision(toolName, args);
  if (!decision.allowed) throw new McpInputError(decision.reason, -32003);
  return decision;
}

async function effectiveMutationDecision(actionType, orgId, args = {}) {
  assertMutationAllowed(actionType);
  const profile = await fetchCustomerPolicyProfile(orgId);
  if (profile.status && profile.status !== "active") {
    return explainPolicyDecision({ allowed: false, reason: `MCP profile is ${profile.status}.`, profile, actionType });
  }
  if (profile.allowedMutations.length > 0 && !profile.allowedMutations.includes(actionType)) {
    return explainPolicyDecision({ allowed: false, reason: `Mutation is not allowed by MCP profile: ${actionType}.`, profile, actionType });
  }
  const actor = userContext(args);
  if (actor.role && profile.allowedRoles.length > 0 && !profile.allowedRoles.includes(actor.role.toLowerCase())) {
    return explainPolicyDecision({ allowed: false, reason: `Role is not allowed by MCP profile: ${actor.role}.`, profile, actionType });
  }
  if (actor.userEmail && profile.allowedEmailDomains.length > 0) {
    const domain = actor.userEmail.split("@").at(-1) ?? "";
    if (!profile.allowedEmailDomains.includes(domain)) {
      return explainPolicyDecision({ allowed: false, reason: `Email domain is not allowed by MCP profile: ${domain}.`, profile, actionType });
    }
  }
  return explainPolicyDecision({ allowed: true, reason: "Allowed by effective MCP mutation policy.", profile, actionType });
}

async function assertEffectiveMutationAllowed(actionType, orgId, args = {}) {
  const decision = await effectiveMutationDecision(actionType, orgId, args);
  if (!decision.allowed) throw new McpInputError(decision.reason, -32003);
  return decision;
}

async function explainBlockedMutation(actionType, orgId, args = {}) {
  try {
    return await effectiveMutationDecision(actionType, orgId, args);
  } catch (error) {
    const profile = await fetchCustomerPolicyProfile(orgId);
    const reason = error instanceof Error ? error.message : String(error);
    return explainPolicyDecision({ allowed: false, reason, profile, actionType });
  }
}

function auditToolCall({ requestId, toolName, orgId, status, resultCount = null, error = null, startedAt }) {
  if (!AUDIT_ENABLED) return;
  const elapsedMs = startedAt ? Date.now() - startedAt : null;
  process.stderr.write(
    `${JSON.stringify({
      event: "solvren_mcp_tool_call",
      requestId,
      caller: CALLER_LABEL,
      toolName,
      orgId,
      status,
      resultCount,
      elapsedMs,
      error,
      at: new Date().toISOString(),
    })}\n`
  );
}

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY_PATTERN = /(token|secret|password|credential|authorization|api[_-]?key|access[_-]?key|private[_-]?key|refresh)/i;

function redact(value) {
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redact(child);
  }
  return out;
}

function sourceRecord(table, id, label) {
  return { table, id, label };
}

function hashPayload(payload) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function expiresAtIso(minutes = ACTION_TTL_MINUTES) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function roleCan(role, permission) {
  const normalized = String(role ?? "viewer").toLowerCase();
  const grants = {
    owner: ["change.approve", "change.comment", "change.evidence.provide", "issues.act", "issues.assign"],
    admin: ["change.approve", "change.comment", "change.evidence.provide", "issues.act", "issues.assign"],
    reviewer: ["change.approve", "change.comment", "change.evidence.provide", "issues.act", "issues.assign"],
    submitter: ["change.comment", "change.evidence.provide", "issues.act"],
    viewer: [],
  };
  return (grants[normalized] ?? grants.viewer).includes(permission);
}

function confirmationPhraseFor(actionType) {
  const phrases = {
    approve_decision: "Approve this decision",
    request_more_proof: "Request more proof",
    attach_proof_link: "Attach this proof",
    assign_problem_owner: "Assign this owner",
    add_problem_comment: "Add this problem comment",
  };
  return phrases[actionType] ?? "Confirm Solvren action";
}

function stableResponse({ toolName, orgId = null, whatThisMeans, whyItMatters, recommendedNextAction, data, sourceRecords = [], links = [] }) {
  return {
    schemaVersion: "solvren.mcp.v1.2",
    toolName,
    orgId,
    generatedAt: new Date().toISOString(),
    whatThisMeans,
    whyItMatters,
    recommendedNextAction,
    sourceRecords,
    links,
    data,
  };
}

function parseToolData(result) {
  return JSON.parse(result.content[0].text).data;
}

function userContext(args) {
  const raw = args?.userContext && typeof args.userContext === "object" ? args.userContext : args;
  return {
    userEmail: typeof raw?.userEmail === "string" ? raw.userEmail.trim().toLowerCase() : null,
    role: typeof raw?.role === "string" ? raw.role.trim().toLowerCase() : null,
  };
}

function roleTone(ctx) {
  if (ctx.role?.includes("executive") || ctx.role?.includes("ceo") || ctx.role?.includes("finance")) {
    return "Keep the answer focused on money at risk, decision confidence, and the next executive action.";
  }
  if (ctx.role?.includes("engineer")) {
    return "Keep the answer focused on blockers, proof, rollout safety, and ownership.";
  }
  if (ctx.role?.includes("risk")) {
    return "Keep the answer focused on policy gaps, evidence, approvals, and auditability.";
  }
  return "Keep the answer focused on what happened, why it matters, and what to do next.";
}

function markdownList(items) {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- None";
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map((value) => String(value)))];
}

function asNumber(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function statusLabel(value) {
  return String(value ?? "").replaceAll("_", " ").toLowerCase();
}

function severityRank(severity) {
  return { critical: 4, high: 3, medium: 2, low: 1 }[String(severity ?? "").toLowerCase()] ?? 0;
}

async function fetchOrganization(orgId) {
  if (ALLOWED_ORG_IDS.length > 0 && !ALLOWED_ORG_IDS.includes(orgId)) {
    throw new McpInputError("This Solvren MCP server is not authorized for the requested organization.", -32001);
  }
  const { data, error } = await supabase.from("organizations").select("id, name").eq("id", orgId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new McpInputError(`Organization not found: ${orgId}`, -32004);
  return data;
}

async function resolveActor(orgId, args) {
  const ctx = userContext(args);
  if (!ctx.userEmail) {
    throw new McpInputError("Controlled writes require userContext.userEmail.", -32002);
  }
  let found = null;
  for (let page = 1; page <= 20 && !found; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(error.message);
    found = (data?.users ?? []).find((user) => String(user.email ?? "").toLowerCase() === ctx.userEmail);
    if ((data?.users ?? []).length < 100) break;
  }
  if (!found) throw new McpInputError(`No Solvren user found for ${ctx.userEmail}.`, -32002);
  const { data: member, error } = await supabase
    .from("organization_members")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", found.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!member) throw new McpInputError(`User ${ctx.userEmail} is not a member of this organization.`, -32002);
  return {
    userId: found.id,
    userEmail: ctx.userEmail,
    role: String(member.role ?? "viewer").toLowerCase(),
  };
}

async function writeMcpActionAudit(row) {
  if (!AUDIT_ENABLED) return;
  const { error } = await supabase.from("mcp_action_audit_log").insert({
    action_request_id: row.actionRequestId ?? null,
    org_id: row.orgId,
    action_type: row.actionType,
    target_table: row.targetTable,
    target_id: row.targetId,
    actor_user_id: row.actorUserId ?? null,
    actor_email: row.actorEmail ?? null,
    caller_label: CALLER_LABEL,
    event_type: row.eventType,
    status: row.status,
    reason: row.reason ?? null,
    payload_hash: row.payloadHash ?? null,
    before_summary: row.beforeSummary ?? null,
    after_summary: row.afterSummary ?? null,
  });
  if (error && WRITE_AUDIT_REQUIRED) throw new Error(`MCP audit log failed: ${error.message}`);
}

async function createActionRequest({ orgId, actor, actionType, targetTable, targetId, payload, humanSummary, riskLevel = "LOW", cannotProceedReasons = [] }) {
  const policyDecision = await assertEffectiveMutationAllowed(actionType, orgId, { userContext: { userEmail: actor.userEmail, role: actor.role } });
  const ttlMinutes = Number(policyDecision.profile?.actionTtlMinutes ?? ACTION_TTL_MINUTES);
  const payloadHash = hashPayload(payload);
  const phrase = confirmationPhraseFor(actionType);
  const status = cannotProceedReasons.length > 0 ? "REJECTED" : "PREPARED";
  const { data, error } = await supabase
    .from("mcp_action_requests")
    .insert({
      org_id: orgId,
      action_type: actionType,
      target_table: targetTable,
      target_id: targetId,
      actor_user_id: actor.userId,
      actor_email: actor.userEmail,
      caller_label: CALLER_LABEL,
      status,
      risk_level: riskLevel,
      confirmation_phrase: phrase,
      payload,
      payload_hash: payloadHash,
      human_summary: humanSummary,
      cannot_proceed_reasons: cannotProceedReasons,
      expires_at: expiresAtIso(ttlMinutes),
    })
    .select("id, expires_at")
    .single();
  if (error) throw new Error(error.message);
  await writeMcpActionAudit({
    actionRequestId: data.id,
    orgId,
    actionType,
    targetTable,
    targetId,
    actorUserId: actor.userId,
    actorEmail: actor.userEmail,
    eventType: "PREPARE",
    status,
    reason: cannotProceedReasons.join("; ") || null,
    payloadHash,
    beforeSummary: humanSummary,
  });
  return {
    actionId: data.id,
    actionType,
    humanSummary,
    riskLevel,
    willChange: status === "PREPARED" ? payload.willChange : [],
    cannotProceedReasons,
    confirmationRequired: Boolean(policyDecision.profile?.requireConfirmation ?? REQUIRE_CONFIRMATION),
    confirmationPhrase: phrase,
    expiresAt: data.expires_at,
  };
}

async function latestAssessments(changeIds) {
  if (changeIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("impact_assessments")
    .select("change_event_id, risk_bucket, risk_score_raw, report_md, created_at")
    .in("change_event_id", changeIds)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const byChange = new Map();
  for (const row of data ?? []) {
    if (!byChange.has(row.change_event_id)) byChange.set(row.change_event_id, row);
  }
  return byChange;
}

async function listActiveChanges(orgId, limit = 20) {
  const { data, error } = await supabase
    .from("change_events")
    .select(
      "id, title, status, change_type, domain, revenue_surface, revenue_at_risk, estimated_mrr_affected, due_at, sla_status, created_at, submitted_at, updated_at"
    )
    .eq("org_id", orgId)
    .in("status", ACTIVE_CHANGE_STATUSES)
    .order("revenue_at_risk", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const riskByChange = await latestAssessments((data ?? []).map((row) => row.id));
  return (data ?? []).map((row) => {
    const risk = riskByChange.get(row.id);
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      statusLabel: statusLabel(row.status),
      surface: row.revenue_surface ?? row.domain ?? row.change_type,
      revenueAtRisk: asNumber(row.revenue_at_risk ?? row.estimated_mrr_affected),
      riskLevel: risk?.risk_bucket ?? null,
      riskScore: risk?.risk_score_raw ?? null,
      dueAt: row.due_at,
      timing: row.sla_status,
      url: `/changes/${row.id}`,
      plainEnglish:
        `${row.title} is ${statusLabel(row.status)}${row.revenue_at_risk ? ` with about $${Math.round(asNumber(row.revenue_at_risk)).toLocaleString()} at risk` : ""}.`,
    };
  });
}

async function listOpenIssues(orgId, limit = 20) {
  const { data, error } = await supabase
    .from("issues")
    .select(
      "id, issue_key, title, summary, description, status, severity, domain_key, priority_score, impact_score, owner_team_key, opened_at, updated_at"
    )
    .eq("org_id", orgId)
    .not("status", "in", `(${CLOSED_ISSUE_STATUSES.join(",")})`)
    .order("priority_score", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchDecisionContext(orgId, decisionId) {
  await fetchOrganization(orgId);
  const { data: change, error } = await supabase
    .from("change_events")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", decisionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!change) throw new McpInputError(`Decision not found: ${decisionId}`, -32004);
  const riskMap = await latestAssessments([decisionId]);
  const latestRisk = riskMap.get(decisionId) ?? null;
  const riskBucket = String(latestRisk?.risk_bucket ?? "MEDIUM").toUpperCase();
  const domain = String(change.domain ?? "REVENUE").toUpperCase();
  const [approvals, evidence, evidencePolicy, approvalPolicy, predictions, linkedIssues] = await Promise.all([
    supabase.from("approvals").select("id, approval_area, decision, comment, decided_at, created_at").eq("org_id", orgId).eq("change_event_id", decisionId),
    supabase.from("change_evidence").select("id, kind, label, url, note, created_at").eq("org_id", orgId).eq("change_event_id", decisionId),
    supabase.from("evidence_requirements").select("evidence_type, required").eq("org_id", orgId),
    supabase
      .from("approval_requirements")
      .select("required_role, min_count, risk_bucket, domain, enabled")
      .eq("org_id", orgId)
      .eq("enabled", true),
    supabase
      .from("predicted_risk_events")
      .select("prediction_type, confidence_score, predicted_impact, status, created_at")
      .eq("org_id", orgId)
      .eq("change_event_id", decisionId)
      .eq("status", "ACTIVE"),
    supabase.from("change_issue_links").select("issue_id, link_type").eq("change_id", decisionId),
  ]);
  for (const result of [approvals, evidence, evidencePolicy, approvalPolicy, predictions, linkedIssues]) {
    if (result.error) throw new Error(result.error.message);
  }
  const providedKinds = unique((evidence.data ?? []).map((item) => item.kind));
  const policyEvidence = (evidencePolicy.data ?? [])
    .filter((item) => item.required)
    .map((item) => item.evidence_type);
  const fallbackEvidence = riskBucket === "CRITICAL" || riskBucket === "HIGH" ? ["PR", "TEST_PLAN", "ROLLBACK"] : ["PR"];
  const requiredEvidence = unique(policyEvidence.length > 0 ? policyEvidence : fallbackEvidence);
  const missingProof = requiredEvidence.filter((kind) => !providedKinds.map((value) => value.toUpperCase()).includes(kind.toUpperCase()));
  const approvalsData = approvals.data ?? [];
  const requiredRoles = unique(
    (approvalPolicy.data ?? [])
      .filter((item) => String(item.domain ?? domain).toUpperCase() === domain)
      .filter((item) => String(item.risk_bucket ?? riskBucket).toUpperCase() === riskBucket)
      .map((item) => item.required_role)
  );
  const existingAreas = unique(approvalsData.map((item) => item.approval_area));
  const pendingApprovals = approvalsData.filter((item) => item.decision === "PENDING");
  const missingApprovalRoles = requiredRoles.filter((role) => !existingAreas.map((area) => area.toUpperCase()).includes(role.toUpperCase()));
  const revenueAtRisk = asNumber(change.revenue_at_risk ?? change.estimated_mrr_affected);
  return {
    change,
    latestRisk,
    riskBucket,
    domain,
    revenueAtRisk,
    approvals: approvalsData,
    evidence: evidence.data ?? [],
    predictions: predictions.data ?? [],
    linkedIssues: linkedIssues.data ?? [],
    requiredEvidence,
    missingProof,
    pendingApprovals,
    missingApprovalRoles,
    blockers: [
      ...missingProof.map((item) => `Missing proof: ${item}`),
      ...pendingApprovals.map((item) => `Pending approval: ${item.approval_area}`),
      ...missingApprovalRoles.map((item) => `Missing approval lane: ${item}`),
    ],
  };
}

async function fetchProblemContext(orgId, problemId) {
  await fetchOrganization(orgId);
  const { data: issue, error } = await supabase.from("issues").select("*").eq("org_id", orgId).eq("id", problemId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!issue) throw new McpInputError(`Problem not found: ${problemId}`, -32004);
  const [impact, actions, sources, links] = await Promise.all([
    supabase
      .from("issue_impact_assessments")
      .select("direct_revenue_loss, revenue_at_risk, operational_cost_estimate, confidence_score, calculated_at")
      .eq("issue_id", problemId)
      .order("calculated_at", { ascending: false })
      .limit(1),
    supabase.from("issue_actions").select("action_type, action_status, external_system, created_at, executed_at").eq("issue_id", problemId),
    supabase.from("issue_sources").select("source_type, source_ref, evidence_json, created_at").eq("issue_id", problemId),
    supabase.from("change_issue_links").select("change_id, link_type").eq("issue_id", problemId),
  ]);
  for (const result of [impact, actions, sources, links]) {
    if (result.error) throw new Error(result.error.message);
  }
  const changeIds = unique((links.data ?? []).map((row) => row.change_id));
  const relatedChanges =
    changeIds.length > 0
      ? (
          await supabase
            .from("change_events")
            .select("id, title, status, revenue_at_risk, estimated_mrr_affected, updated_at")
            .eq("org_id", orgId)
            .in("id", changeIds)
        ).data ?? []
      : [];
  let incidentQuery = supabase
    .from("incidents")
    .select("id, change_event_id, severity, revenue_impact, description, detected_at, resolved_at")
    .eq("org_id", orgId)
    .order("detected_at", { ascending: false })
    .limit(10);
  if (changeIds.length > 0) {
    incidentQuery = incidentQuery.in("change_event_id", changeIds);
  } else {
    incidentQuery = incidentQuery.ilike("description", `%${String(issue.title).slice(0, 32).replaceAll("%", "")}%`);
  }
  const incidents = await incidentQuery;
  if (incidents.error) throw new Error(incidents.error.message);
  return {
    issue,
    impact: impact.data?.[0] ?? null,
    actions: actions.data ?? [],
    sources: sources.data ?? [],
    relatedChanges,
    incidents: incidents.data ?? [],
  };
}

function decisionNextStep(ctx) {
  if (ctx.missingProof.length > 0) return `Attach missing proof: ${ctx.missingProof.join(", ")}.`;
  if (ctx.missingApprovalRoles.length > 0) return `Create missing approval lanes: ${ctx.missingApprovalRoles.join(", ")}.`;
  if (ctx.pendingApprovals.length > 0) return `Ask ${ctx.pendingApprovals.map((item) => item.approval_area).join(", ")} to decide.`;
  if (ctx.predictions.length > 0) return "Review active warnings before approving.";
  return "The decision appears ready for executive review.";
}

function problemActions(ctx) {
  const impact = asNumber(ctx.impact?.revenue_at_risk ?? ctx.impact?.direct_revenue_loss);
  return [
    ctx.issue.owner_team_key || ctx.issue.owner_user_id ? null : "Assign a clear owner.",
    impact > 0 ? `Protect the estimated $${Math.round(impact).toLocaleString()} exposure first.` : "Confirm whether revenue is currently exposed.",
    ctx.relatedChanges.length > 0 ? "Review related decisions for a recent change that may have caused this." : "Identify the system or workflow where the problem originated.",
    "Create or complete the next remediation action.",
    "Verify the result and capture proof.",
  ].filter(Boolean);
}

async function getHomeSummary(args) {
  const orgId = requireString(args, "orgId");
  const [org, changes, issues, incidents, integrations, outcomes] = await Promise.all([
    fetchOrganization(orgId),
    listActiveChanges(orgId, 25),
    listOpenIssues(orgId, 25),
    supabase.from("incidents").select("id, severity, revenue_impact, resolved_at").eq("org_id", orgId),
    supabase.from("integration_connections").select("provider, status, health_status").eq("org_id", orgId),
    supabase
      .from("outcome_metrics")
      .select("revenue_protected, incidents_prevented, approval_hours_saved, period_start")
      .eq("org_id", orgId)
      .order("period_start", { ascending: false })
      .limit(3),
  ]);
  if (incidents.error) throw new Error(incidents.error.message);
  if (integrations.error) throw new Error(integrations.error.message);
  if (outcomes.error) throw new Error(outcomes.error.message);
  const moneyAtRisk = changes.reduce((sum, row) => sum + asNumber(row.revenueAtRisk), 0);
  const highImpactIssues = issues.filter((issue) => severityRank(issue.severity) >= 3).length;
  const openIncidents = (incidents.data ?? []).filter((incident) => !incident.resolved_at);
  const valueProtected = (outcomes.data ?? []).reduce((sum, row) => sum + asNumber(row.revenue_protected), 0);
  const connected = (integrations.data ?? []).filter((row) => ["connected", "configured"].includes(String(row.status)));
  const needsAttention = (integrations.data ?? []).filter((row) => row.status !== "connected" || row.health_status === "error");
  const data = {
    organization: org,
    headline: "Solvren shows what revenue is at risk, what needs action, and what value was protected.",
    moneyAtRisk,
    itemsNeedingAction: changes.length + issues.length,
    decisionsNeedingAction: changes.length,
    problemsDetected: issues.length,
    highImpactProblems: highImpactIssues,
    openIncidents: openIncidents.length,
    valueProtected,
    setupHealth: {
      connectedSystems: connected.length,
      systemsNeedingAttention: needsAttention.length,
    },
    topDecisions: changes.slice(0, 5),
    topProblems: issues.slice(0, 5).map((issue) => ({
      id: issue.id,
      key: issue.issue_key,
      title: issue.title,
      severity: issue.severity,
      status: issue.status,
      owner: issue.owner_team_key,
      plainEnglish: issue.summary ?? issue.description ?? `${issue.title} needs attention.`,
      url: `/problems/${issue.id}`,
    })),
  };
  return jsonText(
    stableResponse({
      toolName: "get_home_summary",
      orgId,
      whatThisMeans: `${org.name} has ${changes.length + issues.length} items that may need attention and $${Math.round(moneyAtRisk).toLocaleString()} currently visible as revenue at risk.`,
      whyItMatters: "This is the executive view of whether revenue-impacting work is protected, blocked, or missing setup coverage.",
      recommendedNextAction: changes[0]
        ? `Review the top decision: ${changes[0].title}.`
        : issues[0]
          ? `Review the top problem: ${issues[0].title}.`
          : "No immediate decision or problem needs attention; review setup health and proof.",
      data,
      sourceRecords: [sourceRecord("organizations", org.id, org.name)],
      links: [{ label: "Open Solvren Home", url: "/" }],
    })
  );
}

async function listDecisionsNeedingAction(args) {
  const orgId = requireString(args, "orgId");
  const limit = optionalLimit(args);
  await fetchOrganization(orgId);
  const decisions = (await listActiveChanges(orgId, limit)).slice(0, limit);
  return jsonText(
    stableResponse({
      toolName: "list_decisions_needing_action",
      orgId,
      whatThisMeans: `${decisions.length} active decisions need review, proof, or approval.`,
      whyItMatters: "These are revenue-impacting changes where slow or unsafe decisions can expose money, customers, or operating confidence.",
      recommendedNextAction: decisions[0] ? `Start with: ${decisions[0].title}.` : "No active decisions need action.",
      data: { decisions },
      sourceRecords: decisions.map((decision) => sourceRecord("change_events", decision.id, decision.title)),
      links: [{ label: "Open Decisions", url: "/changes" }],
    })
  );
}

async function getDecision(args) {
  const orgId = requireString(args, "orgId");
  const decisionId = requireString(args, "decisionId");
  const { data: change, error } = await supabase
    .from("change_events")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", decisionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!change) throw new Error(`Decision not found: ${decisionId}`);
  const [risk, approvals, evidence, predictions, issues] = await Promise.all([
    latestAssessments([decisionId]),
    supabase.from("approvals").select("approval_area, decision, comment, decided_at, created_at").eq("org_id", orgId).eq("change_event_id", decisionId),
    supabase.from("change_evidence").select("kind, label, url, note, created_at").eq("org_id", orgId).eq("change_event_id", decisionId),
    supabase
      .from("predicted_risk_events")
      .select("prediction_type, confidence_score, predicted_impact, status, created_at")
      .eq("org_id", orgId)
      .eq("change_event_id", decisionId)
      .eq("status", "ACTIVE"),
    supabase.from("change_issue_links").select("issue_id, link_type").eq("change_id", decisionId),
  ]);
  for (const result of [approvals, evidence, predictions, issues]) {
    if (result.error) throw new Error(result.error.message);
  }
  const latestRisk = risk.get(decisionId);
  const pendingApprovals = (approvals.data ?? []).filter((row) => row.decision === "PENDING");
  const revenueAtRisk = asNumber(change.revenue_at_risk ?? change.estimated_mrr_affected);
  const data = {
    id: change.id,
    title: change.title,
    whatHappened: change.intake?.summary ?? change.title,
    whyItMatters:
      revenueAtRisk > 0
        ? `About $${Math.round(revenueAtRisk).toLocaleString()} may be exposed if this decision is wrong or delayed.`
        : "This touches a revenue-sensitive system or process.",
    whatShouldHappenNext:
      pendingApprovals.length > 0
        ? `Get ${pendingApprovals.map((row) => row.approval_area).join(", ")} approval.`
        : "Review the proof and decide whether this is ready to proceed.",
    owner: change.owner_team_key ?? change.created_by ?? null,
    status: change.status,
    revenueAtRisk,
    risk: { level: latestRisk?.risk_bucket ?? null, score: latestRisk?.risk_score_raw ?? null },
    proof: { evidenceCount: (evidence.data ?? []).length, items: evidence.data ?? [] },
    approvals: approvals.data ?? [],
    activeWarnings: predictions.data ?? [],
    linkedProblemIds: (issues.data ?? []).map((row) => row.issue_id),
    url: `/changes/${change.id}`,
  };
  return jsonText(
    stableResponse({
      toolName: "get_decision",
      orgId,
      whatThisMeans: data.whatHappened,
      whyItMatters: data.whyItMatters,
      recommendedNextAction: data.whatShouldHappenNext,
      data,
      sourceRecords: [
        sourceRecord("change_events", change.id, change.title),
        ...((evidence.data ?? []).map((item) => sourceRecord("change_evidence", item.label, item.kind))),
      ],
      links: [{ label: "Open Decision", url: `/changes/${change.id}` }],
    })
  );
}

async function listOpenProblems(args) {
  const orgId = requireString(args, "orgId");
  const limit = optionalLimit(args);
  await fetchOrganization(orgId);
  const issues = await listOpenIssues(orgId, limit);
  const problems = issues.map((issue) => ({
      id: issue.id,
      key: issue.issue_key,
      title: issue.title,
      status: issue.status,
      severity: issue.severity,
      priorityScore: issue.priority_score,
      owner: issue.owner_team_key,
      whyItMatters: issue.summary ?? issue.description ?? "This may affect revenue operations.",
      url: `/problems/${issue.id}`,
    }));
  return jsonText(
    stableResponse({
      toolName: "list_open_problems",
      orgId,
      whatThisMeans: `${problems.length} open problems may need ownership, action, or verification.`,
      whyItMatters: "Problems represent detected revenue leakage, operational risk, or change fallout that can reduce confidence in revenue systems.",
      recommendedNextAction: problems[0] ? `Start with: ${problems[0].title}.` : "No open problems need action.",
      data: { problems },
      sourceRecords: problems.map((problem) => sourceRecord("issues", problem.id, problem.title)),
      links: [{ label: "Open Problems", url: "/problems" }],
    })
  );
}

async function getProblem(args) {
  const orgId = requireString(args, "orgId");
  const problemId = requireString(args, "problemId");
  const { data: issue, error } = await supabase.from("issues").select("*").eq("org_id", orgId).eq("id", problemId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!issue) throw new Error(`Problem not found: ${problemId}`);
  const [impact, actions, sources] = await Promise.all([
    supabase
      .from("issue_impact_assessments")
      .select("direct_revenue_loss, revenue_at_risk, operational_cost_estimate, confidence_score, calculated_at")
      .eq("issue_id", problemId)
      .order("calculated_at", { ascending: false })
      .limit(1),
    supabase.from("issue_actions").select("action_type, action_status, external_system, created_at, executed_at").eq("issue_id", problemId),
    supabase.from("issue_sources").select("source_type, source_ref, evidence_json, created_at").eq("issue_id", problemId),
  ]);
  for (const result of [impact, actions, sources]) {
    if (result.error) throw new Error(result.error.message);
  }
  const latestImpact = impact.data?.[0] ?? null;
  const data = {
    id: issue.id,
    key: issue.issue_key,
    title: issue.title,
    whatHappened: issue.summary ?? issue.description ?? issue.title,
    whyItMatters:
      latestImpact?.revenue_at_risk != null
        ? `About $${Math.round(asNumber(latestImpact.revenue_at_risk)).toLocaleString()} is at risk.`
        : "This problem may affect revenue, customer experience, or operational confidence.",
    whatShouldHappenNext: "Assign an owner, complete the recommended action, and verify the result.",
    owner: issue.owner_team_key ?? issue.owner_user_id ?? null,
    status: issue.status,
    severity: issue.severity,
    impact: latestImpact,
    actions: actions.data ?? [],
    sources: sources.data ?? [],
    url: `/problems/${issue.id}`,
  };
  return jsonText(
    stableResponse({
      toolName: "get_problem",
      orgId,
      whatThisMeans: data.whatHappened,
      whyItMatters: data.whyItMatters,
      recommendedNextAction: data.whatShouldHappenNext,
      data,
      sourceRecords: [
        sourceRecord("issues", issue.id, issue.title),
        ...((sources.data ?? []).map((item) => sourceRecord("issue_sources", item.source_ref, item.source_type))),
      ],
      links: [{ label: "Open Problem", url: `/problems/${issue.id}` }],
    })
  );
}

async function getProofSummary(args) {
  const orgId = requireString(args, "orgId");
  await fetchOrganization(orgId);
  const rangeDays = Math.min(Math.max(Number(args?.days ?? 90), 7), 365);
  const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString();
  const [metrics, stories, reports] = await Promise.all([
    supabase
      .from("outcome_metrics")
      .select("period_type, period_start, period_end, revenue_protected, incidents_prevented, approval_hours_saved, readiness_points_gained")
      .eq("org_id", orgId)
      .gte("period_start", since.slice(0, 10))
      .order("period_start", { ascending: false }),
    supabase
      .from("value_stories")
      .select("headline, story_text, estimated_value, confidence_level, status, created_at")
      .eq("org_id", orgId)
      .gte("created_at", since)
      .neq("status", "REJECTED")
      .order("estimated_value", { ascending: false })
      .limit(10),
    supabase
      .from("generated_reports")
      .select("report_type, period_start, period_end, status, storage_url, created_at, completed_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  for (const result of [metrics, stories, reports]) {
    if (result.error) throw new Error(result.error.message);
  }
  const data = {
    orgId,
    rangeDays,
    revenueProtected: (metrics.data ?? []).reduce((sum, row) => sum + asNumber(row.revenue_protected), 0),
    incidentsPrevented: (metrics.data ?? []).reduce((sum, row) => sum + asNumber(row.incidents_prevented), 0),
    approvalHoursSaved: (metrics.data ?? []).reduce((sum, row) => sum + asNumber(row.approval_hours_saved), 0),
    readinessPointsGained: (metrics.data ?? []).reduce((sum, row) => sum + asNumber(row.readiness_points_gained), 0),
    valueStories: stories.data ?? [],
    boardReadyReports: reports.data ?? [],
  };
  return jsonText(
    stableResponse({
      toolName: "get_proof_summary",
      orgId,
      whatThisMeans: `Solvren has recorded $${Math.round(data.revenueProtected).toLocaleString()} in protected value over the selected window.`,
      whyItMatters: "Proof is the executive evidence that Solvren is preventing revenue impact, speeding decisions, and creating board-ready value visibility.",
      recommendedNextAction: data.valueStories.length > 0 ? "Use the top value stories in the next executive update." : "Generate more proof by resolving active decisions and problems.",
      data,
      sourceRecords: [
        ...((metrics.data ?? []).map((metric) => sourceRecord("outcome_metrics", metric.period_start, metric.period_type))),
        ...((stories.data ?? []).map((story) => sourceRecord("value_stories", story.created_at, story.headline))),
      ],
      links: [{ label: "Open Proof", url: "/proof" }],
    })
  );
}

async function generateExecutiveBrief(args) {
  const orgId = requireString(args, "orgId");
  const home = parseToolData(await getHomeSummary({ orgId }));
  const proof = parseToolData(await getProofSummary({ orgId, days: args?.days ?? 90 }));
  const data = {
    title: `${home.organization.name} revenue protection brief`,
    headline: home.headline,
    summary: [
      `$${Math.round(home.moneyAtRisk).toLocaleString()} is currently visible as revenue at risk.`,
      `${home.itemsNeedingAction} items need attention across decisions and problems.`,
      `$${Math.round(proof.revenueProtected).toLocaleString()} has been recorded as protected value in the selected window.`,
    ],
    recommendedActions: [
      home.topDecisions[0] ? `Review decision: ${home.topDecisions[0].title}` : null,
      home.topProblems[0] ? `Resolve problem: ${home.topProblems[0].title}` : null,
      home.setupHealth.systemsNeedingAttention > 0 ? "Finish setup for systems that need attention." : null,
    ].filter(Boolean),
    proof,
  };
  return jsonText(
    stableResponse({
      toolName: "generate_executive_brief",
      orgId,
      whatThisMeans: data.summary.join(" "),
      whyItMatters: "This gives an executive a concise narrative of current exposure, required action, and realized value.",
      recommendedNextAction: data.recommendedActions[0] ?? "Share the brief with the executive team.",
      data,
      sourceRecords: [sourceRecord("organizations", home.organization.id, home.organization.name)],
      links: [{ label: "Open Solvren", url: "/" }],
    })
  );
}

async function getSetupHealth(args) {
  const orgId = requireString(args, "orgId");
  const [org, integrations, steps, state, scans] = await Promise.all([
    fetchOrganization(orgId),
    supabase.from("integration_connections").select("provider, status, health_status, last_health_check_at, updated_at").eq("org_id", orgId),
    supabase.from("org_onboarding_steps").select("step_key, step_group, display_name, step_status, required, blocked_reason_text").eq("org_id", orgId),
    supabase.from("org_onboarding_states").select("*").eq("org_id", orgId).maybeSingle(),
    supabase
      .from("org_onboarding_scan_runs")
      .select("status, source_mode, estimated_revenue_at_risk, issue_count, completed_at, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  for (const result of [integrations, steps, state, scans]) {
    if (result.error) throw new Error(result.error.message);
  }
  const connected = (integrations.data ?? []).filter((row) => ["connected", "configured"].includes(String(row.status)));
  const attention = (integrations.data ?? []).filter((row) => row.status !== "connected" || row.health_status === "error");
  const data = {
    organization: org,
    status: state.data?.guided_phase1_status ?? state.data?.onboarding_state ?? "NOT_STARTED",
    firstValueReached: Boolean(state.data?.first_value_reached),
    connectedSystems: connected.map((row) => `${row.provider} connected`),
    systemsNeedingAttention: attention.map((row) => `${row.provider} needs attention`),
    setupSteps: (steps.data ?? []).map((step) => ({
      name: step.display_name,
      status: step.step_status,
      required: step.required,
      blockedReason: step.blocked_reason_text,
    })),
    latestScan: scans.data?.[0] ?? null,
  };
  return jsonText(
    stableResponse({
      toolName: "get_setup_health",
      orgId,
      whatThisMeans: `${connected.length} systems are connected and ${attention.length} systems need attention.`,
      whyItMatters: "Setup health determines whether Solvren can see enough of the business to catch revenue risk early.",
      recommendedNextAction: attention[0] ? `Fix ${attention[0].provider} setup.` : "Run or review the latest baseline scan.",
      data,
      sourceRecords: [
        sourceRecord("organizations", org.id, org.name),
        ...((integrations.data ?? []).map((item) => sourceRecord("integration_connections", item.provider, item.status))),
      ],
      links: [{ label: "Open Setup", url: "/setup" }],
    })
  );
}

async function getMcpServerHealth() {
  const enabledTools = toolList().map((tool) => tool.name);
  return jsonText(
    stableResponse({
      toolName: "get_mcp_server_health",
      whatThisMeans: "The Solvren MCP server is running in read-only mode.",
      whyItMatters: "Operators can verify the server configuration before connecting an AI assistant to enterprise data.",
      recommendedNextAction:
        ALLOWED_ORG_IDS.length > 0 ? "Use the configured org allowlist for customer deployments." : "Set SOLVREN_MCP_ALLOWED_ORG_IDS before production use.",
      data: {
        serverName: SERVER_NAME,
        serverVersion: SERVER_VERSION,
        mode: ACCESS_MODE,
        callerLabel: CALLER_LABEL,
        auditEnabled: AUDIT_ENABLED,
        maxLimit: MAX_LIMIT,
        allowedOrgCount: ALLOWED_ORG_IDS.length,
        allowedToolsConfigured: ALLOWED_TOOLS.size > 0,
        controlledWriteEnabled: ACCESS_MODE === "controlled_write",
        allowedMutationCount: ALLOWED_MUTATIONS.size,
        requireConfirmation: REQUIRE_CONFIRMATION,
        writeAuditRequired: WRITE_AUDIT_REQUIRED,
        actionTtlMinutes: ACTION_TTL_MINUTES,
        enabledTools,
      },
    })
  );
}

async function getMcpDataFreshness(args) {
  const orgId = requireString(args, "orgId");
  await fetchOrganization(orgId);
  const [changes, issues, outcomes, integrations, scans] = await Promise.all([
    supabase.from("change_events").select("updated_at").eq("org_id", orgId).order("updated_at", { ascending: false }).limit(1),
    supabase.from("issues").select("updated_at").eq("org_id", orgId).order("updated_at", { ascending: false }).limit(1),
    supabase.from("outcome_metrics").select("calculated_at").eq("org_id", orgId).order("calculated_at", { ascending: false }).limit(1),
    supabase.from("integration_connections").select("updated_at").eq("org_id", orgId).order("updated_at", { ascending: false }).limit(1),
    supabase.from("org_onboarding_scan_runs").select("completed_at, updated_at").eq("org_id", orgId).order("updated_at", { ascending: false }).limit(1),
  ]);
  for (const result of [changes, issues, outcomes, integrations, scans]) {
    if (result.error) throw new Error(result.error.message);
  }
  const data = {
    changeDataUpdatedAt: changes.data?.[0]?.updated_at ?? null,
    problemDataUpdatedAt: issues.data?.[0]?.updated_at ?? null,
    proofDataCalculatedAt: outcomes.data?.[0]?.calculated_at ?? null,
    setupDataUpdatedAt: integrations.data?.[0]?.updated_at ?? null,
    latestScanCompletedAt: scans.data?.[0]?.completed_at ?? null,
    latestScanUpdatedAt: scans.data?.[0]?.updated_at ?? null,
  };
  const timestamps = Object.values(data).filter(Boolean).sort();
  const freshest = timestamps.at(-1) ?? null;
  return jsonText(
    stableResponse({
      toolName: "get_mcp_data_freshness",
      orgId,
      whatThisMeans: freshest ? `The freshest Solvren data for this org is from ${freshest}.` : "No freshness markers are available yet for this org.",
      whyItMatters: "AI answers are only as reliable as the latest Solvren data available to the MCP server.",
      recommendedNextAction: freshest ? "Use this timestamp when answering freshness-sensitive executive questions." : "Finish setup or run a baseline scan.",
      data,
      sourceRecords: [sourceRecord("organizations", orgId, "requested org")],
    })
  );
}

async function getMcpPolicy(args) {
  const orgId = requireString(args, "orgId");
  await fetchOrganization(orgId);
  const profile = await fetchCustomerPolicyProfile(orgId);
  return jsonText(stableResponse({
    toolName: "get_mcp_policy",
    orgId,
    whatThisMeans: `MCP is using the ${profile.profileName} policy profile from ${profile.source}.`,
    whyItMatters: "This defines what the assistant is allowed to read, draft, prepare, and confirm.",
    recommendedNextAction: profile.source === "environment" ? "Create a customer MCP policy profile for production deployments." : "Review this policy before enabling controlled writes.",
    data: { profile },
    sourceRecords: profile.id ? [sourceRecord("mcp_policy_profiles", profile.id, profile.profileName)] : [],
  }));
}

async function explainMcpPolicy(args) {
  const orgId = requireString(args, "orgId");
  const profile = await fetchCustomerPolicyProfile(orgId);
  const lines = [
    `Profile: ${profile.profileName}`,
    `Status: ${profile.status}`,
    `Allowed tools: ${profile.allowedTools.length > 0 ? profile.allowedTools.length : "environment/default"}`,
    `Allowed mutations: ${profile.allowedMutations.length > 0 ? profile.allowedMutations.join(", ") : "none unless environment allows"}`,
    `Confirmation required: ${profile.requireConfirmation ? "yes" : "no"}`,
    `Redaction: ${profile.redactionLevel}`,
    `Audit level: ${profile.auditLevel}`,
  ];
  return jsonText(stableResponse({
    toolName: "explain_mcp_policy",
    orgId,
    whatThisMeans: lines.join(". "),
    whyItMatters: "Plain-English policy explanation helps admins and security reviewers understand assistant boundaries.",
    recommendedNextAction: profile.status === "active" ? "Use simulation tools to test a planned tool call or action." : "Activate or replace the MCP profile before using this assistant.",
    data: { explanation: lines, profile },
    sourceRecords: profile.id ? [sourceRecord("mcp_policy_profiles", profile.id, profile.profileName)] : [],
  }));
}

async function listMcpPolicyProfiles(args) {
  const orgId = requireString(args, "orgId");
  await fetchOrganization(orgId);
  const { data, error } = await supabase
    .from("mcp_policy_profiles")
    .select("id, profile_key, profile_name, status, purpose, allowed_tools, allowed_mutations, max_result_limit, audit_level, updated_at, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const profiles = data ?? [];
  return jsonText(stableResponse({
    toolName: "list_mcp_policy_profiles",
    orgId,
    whatThisMeans: `${profiles.length} MCP policy profile(s) are configured for this organization.`,
    whyItMatters: "Profiles let customers run different assistants with different access boundaries.",
    recommendedNextAction: profiles.length > 0 ? "Review active profiles and pause any unused assistant profile." : "Create a conservative read-only profile before production use.",
    data: { profiles },
    sourceRecords: profiles.map((profile) => sourceRecord("mcp_policy_profiles", profile.id, profile.profile_name)),
  }));
}

async function getEffectiveMcpPermissions(args) {
  const orgId = requireString(args, "orgId");
  const profile = await fetchCustomerPolicyProfile(orgId);
  const actor = userContext(args);
  return jsonText(stableResponse({
    toolName: "get_effective_mcp_permissions",
    orgId,
    whatThisMeans: "Effective permissions are the intersection of environment guardrails, customer policy, actor context, and object-specific Solvren permissions.",
    whyItMatters: "Enterprise reviewers need to know the effective boundary, not only the configured boundary.",
    recommendedNextAction: "Use simulate_mcp_tool_call or simulate_mcp_action before enabling a new workflow.",
    data: {
      profile,
      actor,
      environment: {
        mode: ACCESS_MODE,
        allowedTools: [...ALLOWED_TOOLS],
        allowedMutations: [...ALLOWED_MUTATIONS],
        allowedOrgIds: ALLOWED_ORG_IDS,
        maxLimit: MAX_LIMIT,
      },
    },
    sourceRecords: profile.id ? [sourceRecord("mcp_policy_profiles", profile.id, profile.profileName)] : [],
  }));
}

async function simulateMcpToolCall(args) {
  const orgId = requireString(args, "orgId");
  const toolName = requireString(args, "toolName");
  const simulatedArgs = { ...(args?.arguments && typeof args.arguments === "object" ? args.arguments : {}), orgId, userContext: args?.userContext };
  const decision = await effectiveToolDecision(toolName, simulatedArgs);
  return jsonText(stableResponse({
    toolName: "simulate_mcp_tool_call",
    orgId,
    whatThisMeans: decision.allowed ? `Tool ${toolName} would be allowed.` : `Tool ${toolName} would be blocked.`,
    whyItMatters: "Simulation lets admins test assistant capabilities without touching production data.",
    recommendedNextAction: decision.allowed ? "Proceed with the planned read/draft workflow." : "Review the blocked reason and policy profile.",
    data: { simulation: decision },
    sourceRecords: decision.profile?.id ? [sourceRecord("mcp_policy_profiles", decision.profile.id, decision.profile.profileName)] : [],
  }));
}

async function simulateMcpAction(args) {
  const orgId = requireString(args, "orgId");
  const actionType = requireString(args, "actionType");
  const decision = await explainBlockedMutation(actionType, orgId, args);
  return jsonText(stableResponse({
    toolName: "simulate_mcp_action",
    orgId,
    whatThisMeans: decision.allowed ? `Action ${actionType} would be allowed by policy.` : `Action ${actionType} would be blocked by policy.`,
    whyItMatters: "Action simulation validates controlled writes before an assistant prepares an action.",
    recommendedNextAction: decision.allowed ? "Use the matching prepare tool, then confirm explicitly." : "Review the blocked reason before changing policy.",
    data: { simulation: decision },
    sourceRecords: decision.profile?.id ? [sourceRecord("mcp_policy_profiles", decision.profile.id, decision.profile.profileName)] : [],
  }));
}

async function explainWhyMcpActionBlocked(args) {
  const orgId = requireString(args, "orgId");
  const actionType = requireString(args, "actionType");
  const decision = await explainBlockedMutation(actionType, orgId, args);
  return jsonText(stableResponse({
    toolName: "explain_why_mcp_action_blocked",
    orgId,
    whatThisMeans: decision.allowed ? `Action ${actionType} is not blocked by current MCP policy.` : decision.reason,
    whyItMatters: "Clear blocked-action explanations help admins tune policy without weakening enterprise controls.",
    recommendedNextAction: decision.allowed ? "Run the prepare tool if the actor has object-level permission." : "Only adjust policy if this action should be allowed for this assistant profile.",
    data: { actionType, decision },
    sourceRecords: decision.profile?.id ? [sourceRecord("mcp_policy_profiles", decision.profile.id, decision.profile.profileName)] : [],
  }));
}

async function getMcpAuditSummary(args) {
  const orgId = requireString(args, "orgId");
  const days = Math.min(Math.max(Number(args?.days ?? 30), 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("mcp_action_audit_log")
    .select("action_type, event_type, status, caller_label, created_at")
    .eq("org_id", orgId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const byStatus = rows.reduce((acc, row) => ({ ...acc, [row.status]: (acc[row.status] ?? 0) + 1 }), {});
  const byAction = rows.reduce((acc, row) => ({ ...acc, [row.action_type]: (acc[row.action_type] ?? 0) + 1 }), {});
  return jsonText(stableResponse({
    toolName: "get_mcp_audit_summary",
    orgId,
    whatThisMeans: `${rows.length} MCP action audit event(s) were recorded in the last ${days} day(s).`,
    whyItMatters: "Audit summaries show how assistants are being used and whether writes are succeeding, failing, or being blocked.",
    recommendedNextAction: rows.some((row) => row.status === "FAILED" || row.status === "REJECTED") ? "Review rejected or failed MCP actions." : "No failed or rejected action events are visible in this window.",
    data: { days, totalEvents: rows.length, byStatus, byAction },
    sourceRecords: [],
  }));
}

async function getMcpActionHistory(args) {
  const orgId = requireString(args, "orgId");
  const limit = optionalLimit(args, 25);
  const { data, error } = await supabase
    .from("mcp_action_audit_log")
    .select("id, action_request_id, action_type, target_table, target_id, actor_email, caller_label, event_type, status, reason, before_summary, after_summary, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return jsonText(stableResponse({
    toolName: "get_mcp_action_history",
    orgId,
    whatThisMeans: `${data?.length ?? 0} recent MCP action event(s) are available.`,
    whyItMatters: "Action history gives admins a reviewable trail of prepared, confirmed, executed, rejected, and failed assistant actions.",
    recommendedNextAction: "Review any rejected or failed events before expanding MCP policy.",
    data: { events: data ?? [] },
    sourceRecords: (data ?? []).map((event) => sourceRecord("mcp_action_audit_log", event.id, event.action_type)),
  }));
}

async function generateMcpTrustReport(args) {
  const orgId = requireString(args, "orgId");
  const policy = parseToolData(await getMcpPolicy({ orgId }));
  const audit = parseToolData(await getMcpAuditSummary({ orgId, days: args?.days ?? 30 }));
  const markdown = `# Solvren MCP Trust Report

## Policy
- Profile: ${policy.profile.profileName}
- Source: ${policy.profile.source}
- Status: ${policy.profile.status}
- Allowed tools: ${policy.profile.allowedTools.length || "environment/default"}
- Allowed mutations: ${policy.profile.allowedMutations.length ? policy.profile.allowedMutations.join(", ") : "none configured"}
- Redaction: ${policy.profile.redactionLevel}
- Audit level: ${policy.profile.auditLevel}

## Action Audit
- Window: ${audit.days} day(s)
- Total action audit events: ${audit.totalEvents}
- By status: ${JSON.stringify(audit.byStatus)}
- By action: ${JSON.stringify(audit.byAction)}

## Enterprise Notes
- MCP cannot modify its own policy.
- Controlled writes require identity, permission, explicit confirmation, and audit logging.
- Destructive actions, integration credentials, user invites, billing, license, and org administration are outside this MCP implementation.`;
  return jsonText(stableResponse({
    toolName: "generate_mcp_trust_report",
    orgId,
    whatThisMeans: "A security-reviewable MCP trust report is ready.",
    whyItMatters: "Trust reports help CIOs, CISOs, and enterprise admins understand assistant boundaries and recent activity.",
    recommendedNextAction: "Share this report with security reviewers before enabling broader MCP access.",
    data: { markdown, policy, audit },
    sourceRecords: [],
  }));
}

async function explainDecisionReadiness(args) {
  const orgId = requireString(args, "orgId");
  const decisionId = requireString(args, "decisionId");
  const ctx = await fetchDecisionContext(orgId, decisionId);
  const ready = ctx.blockers.length === 0;
  const user = userContext(args);
  const data = {
    decisionId,
    title: ctx.change.title,
    readyForApproval: ready,
    readinessState: ready ? "READY_FOR_REVIEW" : "BLOCKED",
    blockers: ctx.blockers,
    missingProof: ctx.missingProof,
    pendingApprovals: ctx.pendingApprovals,
    activeWarnings: ctx.predictions,
    revenueAtRisk: ctx.revenueAtRisk,
    roleGuidance: roleTone(user),
  };
  return jsonText(
    stableResponse({
      toolName: "explain_decision_readiness",
      orgId,
      whatThisMeans: ready ? `${ctx.change.title} has no obvious MCP-visible blockers.` : `${ctx.change.title} is blocked by ${ctx.blockers.length} item(s).`,
      whyItMatters: "Readiness tells leaders whether a revenue-impacting change can be approved confidently or needs more proof first.",
      recommendedNextAction: decisionNextStep(ctx),
      data,
      sourceRecords: [sourceRecord("change_events", ctx.change.id, ctx.change.title)],
      links: [{ label: "Open Decision", url: `/changes/${ctx.change.id}` }],
    })
  );
}

async function listMissingProof(args) {
  const orgId = requireString(args, "orgId");
  const decisionId = requireString(args, "decisionId");
  const ctx = await fetchDecisionContext(orgId, decisionId);
  return jsonText(
    stableResponse({
      toolName: "list_missing_proof",
      orgId,
      whatThisMeans: ctx.missingProof.length > 0 ? `${ctx.missingProof.length} proof item(s) are missing.` : "No required proof appears to be missing.",
      whyItMatters: "Proof gives approvers confidence that revenue-impacting work is safe to proceed.",
      recommendedNextAction: ctx.missingProof[0] ? `Attach ${ctx.missingProof[0]} first.` : "Move to approval review.",
      data: { decisionId, requiredProof: ctx.requiredEvidence, attachedProof: ctx.evidence, missingProof: ctx.missingProof },
      sourceRecords: [sourceRecord("change_events", ctx.change.id, ctx.change.title)],
      links: [{ label: "Open Proof Section", url: `/changes/${ctx.change.id}` }],
    })
  );
}

async function listPendingApprovers(args) {
  const orgId = requireString(args, "orgId");
  const decisionId = requireString(args, "decisionId");
  const ctx = await fetchDecisionContext(orgId, decisionId);
  return jsonText(
    stableResponse({
      toolName: "list_pending_approvers",
      orgId,
      whatThisMeans: `${ctx.pendingApprovals.length} approver(s) still need to decide.`,
      whyItMatters: "Pending approvers are the people or lanes currently holding up the decision.",
      recommendedNextAction: ctx.pendingApprovals[0] ? `Ask ${ctx.pendingApprovals[0].approval_area} to decide.` : "No approver follow-up is needed.",
      data: {
        decisionId,
        pendingApprovals: ctx.pendingApprovals,
        missingApprovalRoles: ctx.missingApprovalRoles,
        allApprovals: ctx.approvals,
      },
      sourceRecords: [sourceRecord("change_events", ctx.change.id, ctx.change.title)],
      links: [{ label: "Open Approvals", url: `/changes/${ctx.change.id}` }],
    })
  );
}

async function recommendDecisionNextStep(args) {
  const orgId = requireString(args, "orgId");
  const decisionId = requireString(args, "decisionId");
  const ctx = await fetchDecisionContext(orgId, decisionId);
  const recommendation = decisionNextStep(ctx);
  return jsonText(
    stableResponse({
      toolName: "recommend_decision_next_step",
      orgId,
      whatThisMeans: recommendation,
      whyItMatters: "A single next step keeps the decision workflow simple and avoids executive confusion.",
      recommendedNextAction: recommendation,
      data: { decisionId, recommendation, blockers: ctx.blockers, revenueAtRisk: ctx.revenueAtRisk, activeWarnings: ctx.predictions },
      sourceRecords: [sourceRecord("change_events", ctx.change.id, ctx.change.title)],
      links: [{ label: "Open Decision", url: `/changes/${ctx.change.id}` }],
    })
  );
}

async function recommendProblemActions(args) {
  const orgId = requireString(args, "orgId");
  const problemId = requireString(args, "problemId");
  const ctx = await fetchProblemContext(orgId, problemId);
  const actions = problemActions(ctx);
  return jsonText(
    stableResponse({
      toolName: "recommend_problem_actions",
      orgId,
      whatThisMeans: `${ctx.issue.title} needs ${actions.length} practical follow-up action(s).`,
      whyItMatters: "Problem actions turn detected revenue risk into owned, verifiable remediation.",
      recommendedNextAction: actions[0] ?? "No action recommended.",
      data: { problemId, actions, currentStatus: ctx.issue.status, owner: ctx.issue.owner_team_key ?? ctx.issue.owner_user_id },
      sourceRecords: [sourceRecord("issues", ctx.issue.id, ctx.issue.title)],
      links: [{ label: "Open Problem", url: `/problems/${ctx.issue.id}` }],
    })
  );
}

async function summarizeProblemRootCause(args) {
  const orgId = requireString(args, "orgId");
  const problemId = requireString(args, "problemId");
  const ctx = await fetchProblemContext(orgId, problemId);
  const sourceTypes = unique(ctx.sources.map((item) => item.source_type));
  const summary = ctx.issue.summary ?? ctx.issue.description ?? `${ctx.issue.title} was detected from ${sourceTypes.join(", ") || "available Solvren signals"}.`;
  return jsonText(
    stableResponse({
      toolName: "summarize_problem_root_cause",
      orgId,
      whatThisMeans: summary,
      whyItMatters: "Root-cause framing helps teams fix the source of revenue risk instead of only acknowledging the symptom.",
      recommendedNextAction: ctx.relatedChanges[0] ? `Review related decision: ${ctx.relatedChanges[0].title}.` : "Confirm the source system and assign the owner closest to it.",
      data: { problemId, summary, sourceTypes, sources: ctx.sources, relatedChanges: ctx.relatedChanges },
      sourceRecords: [sourceRecord("issues", ctx.issue.id, ctx.issue.title)],
      links: [{ label: "Open Problem", url: `/problems/${ctx.issue.id}` }],
    })
  );
}

async function listRelatedDecisions(args) {
  const orgId = requireString(args, "orgId");
  const problemId = requireString(args, "problemId");
  const ctx = await fetchProblemContext(orgId, problemId);
  return jsonText(
    stableResponse({
      toolName: "list_related_decisions",
      orgId,
      whatThisMeans: `${ctx.relatedChanges.length} decision(s) are linked to this problem.`,
      whyItMatters: "Related decisions show whether a change may have created or can resolve the problem.",
      recommendedNextAction: ctx.relatedChanges[0] ? `Review ${ctx.relatedChanges[0].title}.` : "No related decision is linked; investigate source records.",
      data: { problemId, decisions: ctx.relatedChanges },
      sourceRecords: ctx.relatedChanges.map((change) => sourceRecord("change_events", change.id, change.title)),
      links: [{ label: "Open Problem", url: `/problems/${ctx.issue.id}` }],
    })
  );
}

async function listRelatedIncidents(args) {
  const orgId = requireString(args, "orgId");
  const problemId = requireString(args, "problemId");
  const ctx = await fetchProblemContext(orgId, problemId);
  return jsonText(
    stableResponse({
      toolName: "list_related_incidents",
      orgId,
      whatThisMeans: `${ctx.incidents.length} incident(s) may be related to this problem.`,
      whyItMatters: "Related incidents show whether the problem has already affected customers, revenue, or operations.",
      recommendedNextAction: ctx.incidents[0] ? "Review the most recent related incident." : "No related incident is visible; continue remediation and verification.",
      data: { problemId, incidents: ctx.incidents },
      sourceRecords: ctx.incidents.map((incident) => sourceRecord("incidents", incident.id, incident.description ?? "incident")),
      links: [{ label: "Open Problem", url: `/problems/${ctx.issue.id}` }],
    })
  );
}

async function generateBoardBrief(args) {
  const orgId = requireString(args, "orgId");
  const home = parseToolData(await getHomeSummary({ orgId }));
  const proof = parseToolData(await getProofSummary({ orgId, days: args?.days ?? 90 }));
  const markdown = `# ${home.organization.name} Solvren Board Brief

## Executive Summary
${home.headline}

## Current Exposure
- Revenue currently visible as at risk: $${Math.round(home.moneyAtRisk).toLocaleString()}
- Items needing action: ${home.itemsNeedingAction}
- Problems detected: ${home.problemsDetected}

## Value Protected
- Revenue protected: $${Math.round(proof.revenueProtected).toLocaleString()}
- Incidents prevented: ${proof.incidentsPrevented}
- Approval hours saved: ${proof.approvalHoursSaved}

## Recommended Actions
${markdownList([
  home.topDecisions[0] ? `Review decision: ${home.topDecisions[0].title}` : null,
  home.topProblems[0] ? `Resolve problem: ${home.topProblems[0].title}` : null,
  home.setupHealth.systemsNeedingAttention > 0 ? "Complete setup for systems needing attention" : null,
].filter(Boolean))}`;
  return jsonText(
    stableResponse({
      toolName: "generate_board_brief",
      orgId,
      whatThisMeans: "A board-ready summary of exposure, required action, and protected value is ready.",
      whyItMatters: "Board-level proof helps executives see Solvren as a revenue protection system, not a workflow tracker.",
      recommendedNextAction: "Review the brief and attach current proof packets before sharing.",
      data: { markdown, home, proof },
      sourceRecords: [sourceRecord("organizations", home.organization.id, home.organization.name)],
      links: [{ label: "Open Proof", url: "/proof" }],
    })
  );
}

async function generateDecisionBrief(args) {
  const orgId = requireString(args, "orgId");
  const decisionId = requireString(args, "decisionId");
  const ctx = await fetchDecisionContext(orgId, decisionId);
  const markdown = `# Decision Brief: ${ctx.change.title}

## What Happened
${ctx.change.intake?.summary ?? ctx.change.title}

## Why It Matters
${ctx.revenueAtRisk > 0 ? `About $${Math.round(ctx.revenueAtRisk).toLocaleString()} may be exposed.` : "This touches a revenue-sensitive system or process."}

## Readiness
${ctx.blockers.length === 0 ? "No obvious blockers are visible." : markdownList(ctx.blockers)}

## Proof
${markdownList(ctx.evidence.map((item) => `${item.kind}: ${item.label}`))}

## Next Action
${decisionNextStep(ctx)}`;
  return jsonText(
    stableResponse({
      toolName: "generate_decision_brief",
      orgId,
      whatThisMeans: `${ctx.change.title} has a structured executive decision brief.`,
      whyItMatters: "Decision briefs make approval conversations clear, short, and evidence-backed.",
      recommendedNextAction: decisionNextStep(ctx),
      data: { markdown, decisionId, blockers: ctx.blockers, evidence: ctx.evidence, approvals: ctx.approvals },
      sourceRecords: [sourceRecord("change_events", ctx.change.id, ctx.change.title)],
      links: [{ label: "Open Decision", url: `/changes/${ctx.change.id}` }],
    })
  );
}

async function generateProblemBrief(args) {
  const orgId = requireString(args, "orgId");
  const problemId = requireString(args, "problemId");
  const ctx = await fetchProblemContext(orgId, problemId);
  const actions = problemActions(ctx);
  const markdown = `# Problem Brief: ${ctx.issue.title}

## What Happened
${ctx.issue.summary ?? ctx.issue.description ?? ctx.issue.title}

## Why It Matters
${ctx.impact?.revenue_at_risk != null ? `About $${Math.round(asNumber(ctx.impact.revenue_at_risk)).toLocaleString()} is at risk.` : "This may affect revenue operations or customer confidence."}

## Recommended Actions
${markdownList(actions)}

## Related Decisions
${markdownList(ctx.relatedChanges.map((change) => `${change.title} (${change.status})`))}

## Related Incidents
${markdownList(ctx.incidents.map((incident) => incident.description ?? `Incident ${incident.id}`))}`;
  return jsonText(
    stableResponse({
      toolName: "generate_problem_brief",
      orgId,
      whatThisMeans: `${ctx.issue.title} has a structured resolution brief.`,
      whyItMatters: "Problem briefs help teams move from signal to owner, action, and verification.",
      recommendedNextAction: actions[0] ?? "Assign an owner and verify the problem.",
      data: { markdown, problemId, actions, impact: ctx.impact, relatedChanges: ctx.relatedChanges, incidents: ctx.incidents },
      sourceRecords: [sourceRecord("issues", ctx.issue.id, ctx.issue.title)],
      links: [{ label: "Open Problem", url: `/problems/${ctx.issue.id}` }],
    })
  );
}

async function generateSetupGapSummary(args) {
  const orgId = requireString(args, "orgId");
  const setup = parseToolData(await getSetupHealth({ orgId }));
  const markdown = `# Solvren Setup Gap Summary

## Status
${setup.status}

## Connected Systems
${markdownList(setup.connectedSystems)}

## Systems Needing Attention
${markdownList(setup.systemsNeedingAttention)}

## Required Setup Steps
${markdownList(setup.setupSteps.filter((step) => step.required && step.status !== "COMPLETED").map((step) => `${step.name}: ${step.status}${step.blockedReason ? ` (${step.blockedReason})` : ""}`))}

## Next Action
${setup.systemsNeedingAttention[0] ?? "Run or review the latest baseline scan."}`;
  return jsonText(
    stableResponse({
      toolName: "generate_setup_gap_summary",
      orgId,
      whatThisMeans: "A setup gap summary is ready.",
      whyItMatters: "Setup gaps are coverage gaps; Solvren cannot protect what it cannot see.",
      recommendedNextAction: setup.systemsNeedingAttention[0] ?? "Run or review the latest baseline scan.",
      data: { markdown, setup },
      sourceRecords: [sourceRecord("organizations", setup.organization.id, setup.organization.name)],
      links: [{ label: "Open Setup", url: "/setup" }],
    })
  );
}

async function draftApprovalComment(args) {
  const orgId = requireString(args, "orgId");
  const decisionId = requireString(args, "decisionId");
  const ctx = await fetchDecisionContext(orgId, decisionId);
  const user = userContext(args);
  const draft = ctx.blockers.length === 0
    ? `I am comfortable approving "${ctx.change.title}" based on the available proof and current risk view. ${roleTone(user)}`
    : `I am not ready to approve "${ctx.change.title}" yet. Please resolve: ${ctx.blockers.join("; ")}.`;
  return jsonText(
    stableResponse({
      toolName: "draft_approval_comment",
      orgId,
      whatThisMeans: "A draft approval comment is ready; no approval was submitted.",
      whyItMatters: "Draft comments help approvers communicate clearly without mutating Solvren state.",
      recommendedNextAction: "Review and edit the draft before posting it manually.",
      data: { decisionId, draft, mutatesData: false },
      sourceRecords: [sourceRecord("change_events", ctx.change.id, ctx.change.title)],
    })
  );
}

async function draftRequestForProof(args) {
  const orgId = requireString(args, "orgId");
  const decisionId = requireString(args, "decisionId");
  const ctx = await fetchDecisionContext(orgId, decisionId);
  const proof = ctx.missingProof.length > 0 ? ctx.missingProof.join(", ") : "the clearest proof that this is safe to ship";
  const draft = `Please add ${proof} for "${ctx.change.title}" so reviewers can confidently decide. Once attached, Solvren can show whether the decision is ready.`;
  return jsonText(
    stableResponse({
      toolName: "draft_request_for_proof",
      orgId,
      whatThisMeans: "A proof request draft is ready.",
      whyItMatters: "Clear proof requests reduce back-and-forth and help unblock approvals.",
      recommendedNextAction: "Send the draft to the owner or approver lane responsible for the missing proof.",
      data: { decisionId, missingProof: ctx.missingProof, draft, mutatesData: false },
      sourceRecords: [sourceRecord("change_events", ctx.change.id, ctx.change.title)],
    })
  );
}

async function draftOwnerMessage(args) {
  const orgId = requireString(args, "orgId");
  const problemId = requireString(args, "problemId");
  const ctx = await fetchProblemContext(orgId, problemId);
  const actions = problemActions(ctx);
  const draft = `Can you take ownership of "${ctx.issue.title}"? Recommended next step: ${actions[0] ?? "confirm impact and remediation path"}. Please capture the action taken and verification proof in Solvren.`;
  return jsonText(
    stableResponse({
      toolName: "draft_owner_message",
      orgId,
      whatThisMeans: "An owner follow-up message is ready.",
      whyItMatters: "Problems become valuable only when someone owns the fix and verification.",
      recommendedNextAction: "Send the draft to the likely owner.",
      data: { problemId, draft, mutatesData: false },
      sourceRecords: [sourceRecord("issues", ctx.issue.id, ctx.issue.title)],
    })
  );
}

async function draftExecUpdate(args) {
  const orgId = requireString(args, "orgId");
  const home = parseToolData(await getHomeSummary({ orgId }));
  const draft = `Solvren update: $${Math.round(home.moneyAtRisk).toLocaleString()} is currently visible as revenue at risk across ${home.itemsNeedingAction} item(s). ${home.topDecisions[0] ? `Top decision: ${home.topDecisions[0].title}. ` : ""}${home.topProblems[0] ? `Top problem: ${home.topProblems[0].title}. ` : ""}Recommended next action: ${home.topDecisions[0]?.title ?? home.topProblems[0]?.title ?? "review setup and proof health"}.`;
  return jsonText(
    stableResponse({
      toolName: "draft_exec_update",
      orgId,
      whatThisMeans: "An executive update draft is ready.",
      whyItMatters: "Short executive updates keep the value and action loop visible outside the product.",
      recommendedNextAction: "Review and send the draft to the executive audience.",
      data: { draft, mutatesData: false, home },
      sourceRecords: [sourceRecord("organizations", home.organization.id, home.organization.name)],
    })
  );
}

async function recommendNextSetupStep(args) {
  const orgId = requireString(args, "orgId");
  const setup = parseToolData(await getSetupHealth({ orgId }));
  const blockedRequired = setup.setupSteps.find((step) => step.required && step.status !== "COMPLETED");
  const recommendation = setup.systemsNeedingAttention[0] ?? (blockedRequired ? `Complete ${blockedRequired.name}.` : "Run a baseline scan to surface first value.");
  return jsonText(
    stableResponse({
      toolName: "recommend_next_setup_step",
      orgId,
      whatThisMeans: recommendation,
      whyItMatters: "A single setup next step helps implementation feel easy and inevitable.",
      recommendedNextAction: recommendation,
      data: { recommendation, setup },
      sourceRecords: [sourceRecord("organizations", setup.organization.id, setup.organization.name)],
      links: [{ label: "Open Setup", url: "/setup" }],
    })
  );
}

async function explainCoverageGap(args) {
  const orgId = requireString(args, "orgId");
  const setup = parseToolData(await getSetupHealth({ orgId }));
  const gap = requireString(args, "gap");
  return jsonText(
    stableResponse({
      toolName: "explain_coverage_gap",
      orgId,
      whatThisMeans: `${gap} is a coverage gap if Solvren cannot observe the system, workflow, or decision data behind it.`,
      whyItMatters: "Coverage gaps reduce Solvren's ability to detect revenue risk early and prove value later.",
      recommendedNextAction: setup.systemsNeedingAttention.find((item) => item.toLowerCase().includes(gap.toLowerCase())) ?? `Connect or verify the ${gap} source.`,
      data: { gap, setup },
      sourceRecords: [sourceRecord("organizations", setup.organization.id, setup.organization.name)],
    })
  );
}

async function listUnprotectedRevenueSurfaces(args) {
  const orgId = requireString(args, "orgId");
  const setup = parseToolData(await getSetupHealth({ orgId }));
  const connected = setup.connectedSystems.join(" ").toLowerCase();
  const surfaces = [
    { surface: "Billing", expectedSystems: ["stripe", "netsuite"], protected: connected.includes("stripe") || connected.includes("netsuite") },
    { surface: "CRM / pipeline", expectedSystems: ["salesforce", "hubspot"], protected: connected.includes("salesforce") || connected.includes("hubspot") },
    { surface: "Engineering changes", expectedSystems: ["github", "jira"], protected: connected.includes("github") || connected.includes("jira") },
    { surface: "Team communication", expectedSystems: ["slack"], protected: connected.includes("slack") },
  ];
  const unprotected = surfaces.filter((surface) => !surface.protected);
  return jsonText(
    stableResponse({
      toolName: "list_unprotected_revenue_surfaces",
      orgId,
      whatThisMeans: `${unprotected.length} revenue surface(s) appear under-instrumented.`,
      whyItMatters: "Unprotected surfaces are where revenue-impacting changes or problems can happen without Solvren seeing them early.",
      recommendedNextAction: unprotected[0] ? `Connect coverage for ${unprotected[0].surface}.` : "All standard surfaces appear to have basic coverage.",
      data: { surfaces, unprotected, setup },
      sourceRecords: [sourceRecord("organizations", setup.organization.id, setup.organization.name)],
      links: [{ label: "Open Setup", url: "/setup" }],
    })
  );
}

async function prepareApproveDecision(args) {
  const orgId = requireString(args, "orgId");
  const decisionId = requireString(args, "decisionId");
  const actor = await resolveActor(orgId, args);
  const ctx = await fetchDecisionContext(orgId, decisionId);
  const approvalId = typeof args?.approvalId === "string" ? args.approvalId : null;
  const candidateApprovals = ctx.pendingApprovals.filter((approval) =>
    approvalId ? approval.id === approvalId : approval.approver_user_id === actor.userId
  );
  const approval = candidateApprovals[0] ?? null;
  const cannotProceedReasons = [
    !roleCan(actor.role, "change.approve") ? "Actor role cannot approve changes." : null,
    !approval ? "No pending approval assigned to this actor was found." : null,
    ...ctx.missingProof.map((item) => `Missing required proof: ${item}`),
    ctx.predictions.length > 0 ? "Active warning exists; review before approval." : null,
  ].filter(Boolean);
  const payload = {
    approvalId: approval?.id ?? approvalId,
    decisionId,
    comment: typeof args?.comment === "string" ? args.comment : "Approved via Solvren MCP controlled action.",
    willChange: [`Set approval ${approval?.approval_area ?? approvalId ?? ""} to APPROVED.`],
  };
  const prepared = await createActionRequest({
    orgId,
    actor,
    actionType: "approve_decision",
    targetTable: "approvals",
    targetId: payload.approvalId ?? decisionId,
    payload,
    humanSummary: `Approve decision "${ctx.change.title}" as ${actor.userEmail}.`,
    riskLevel: ctx.revenueAtRisk > 100000 || ctx.riskBucket === "CRITICAL" ? "HIGH" : "MEDIUM",
    cannotProceedReasons,
  });
  return jsonText(stableResponse({
    toolName: "prepare_approve_decision",
    orgId,
    whatThisMeans: prepared.cannotProceedReasons.length > 0 ? "Approval cannot proceed yet." : "Approval is prepared and waiting for confirmation.",
    whyItMatters: "Approving a decision changes governance state, so Solvren requires identity, permission, readiness, and confirmation.",
    recommendedNextAction: prepared.cannotProceedReasons[0] ?? `Confirm with phrase: ${prepared.confirmationPhrase}`,
    data: prepared,
    sourceRecords: [sourceRecord("change_events", ctx.change.id, ctx.change.title)],
  }));
}

async function prepareRequestMoreProof(args) {
  const orgId = requireString(args, "orgId");
  const decisionId = requireString(args, "decisionId");
  const actor = await resolveActor(orgId, args);
  const ctx = await fetchDecisionContext(orgId, decisionId);
  const message = typeof args?.message === "string" && args.message.trim()
    ? args.message.trim()
    : `Please add missing proof: ${(ctx.missingProof.length ? ctx.missingProof : ["supporting evidence"]).join(", ")}.`;
  const cannotProceedReasons = [!roleCan(actor.role, "change.comment") ? "Actor role cannot comment on changes." : null].filter(Boolean);
  const prepared = await createActionRequest({
    orgId,
    actor,
    actionType: "request_more_proof",
    targetTable: "change_timeline_events",
    targetId: decisionId,
    payload: { decisionId, message, willChange: ["Add a change timeline event requesting more proof."] },
    humanSummary: `Request more proof for "${ctx.change.title}".`,
    riskLevel: "LOW",
    cannotProceedReasons,
  });
  return jsonText(stableResponse({
    toolName: "prepare_request_more_proof",
    orgId,
    whatThisMeans: prepared.cannotProceedReasons.length > 0 ? "Proof request cannot proceed yet." : "Proof request is prepared and waiting for confirmation.",
    whyItMatters: "Proof requests should be visible and audit logged, not hidden in an assistant conversation.",
    recommendedNextAction: prepared.cannotProceedReasons[0] ?? `Confirm with phrase: ${prepared.confirmationPhrase}`,
    data: prepared,
    sourceRecords: [sourceRecord("change_events", ctx.change.id, ctx.change.title)],
  }));
}

async function prepareAttachProofLink(args) {
  const orgId = requireString(args, "orgId");
  const decisionId = requireString(args, "decisionId");
  const actor = await resolveActor(orgId, args);
  const ctx = await fetchDecisionContext(orgId, decisionId);
  const kind = requireString(args, "kind");
  const label = requireString(args, "label");
  const url = typeof args?.url === "string" ? args.url.trim() : null;
  const note = typeof args?.note === "string" ? args.note.trim() : null;
  const cannotProceedReasons = [
    !roleCan(actor.role, "change.evidence.provide") ? "Actor role cannot provide evidence." : null,
    url && !/^https?:\/\//i.test(url) ? "Proof URL must start with http:// or https://." : null,
  ].filter(Boolean);
  const prepared = await createActionRequest({
    orgId,
    actor,
    actionType: "attach_proof_link",
    targetTable: "change_evidence",
    targetId: decisionId,
    payload: { decisionId, kind, label, url, note, willChange: [`Attach ${kind} proof named "${label}".`] },
    humanSummary: `Attach proof "${label}" to "${ctx.change.title}".`,
    riskLevel: "LOW",
    cannotProceedReasons,
  });
  return jsonText(stableResponse({
    toolName: "prepare_attach_proof_link",
    orgId,
    whatThisMeans: prepared.cannotProceedReasons.length > 0 ? "Proof attachment cannot proceed yet." : "Proof attachment is prepared and waiting for confirmation.",
    whyItMatters: "Attached proof becomes part of the decision record and must be attributable.",
    recommendedNextAction: prepared.cannotProceedReasons[0] ?? `Confirm with phrase: ${prepared.confirmationPhrase}`,
    data: prepared,
    sourceRecords: [sourceRecord("change_events", ctx.change.id, ctx.change.title)],
  }));
}

async function prepareAssignProblemOwner(args) {
  const orgId = requireString(args, "orgId");
  const problemId = requireString(args, "problemId");
  const ownerUserEmail = requireString(args, "ownerUserEmail").toLowerCase();
  const actor = await resolveActor(orgId, args);
  const ctx = await fetchProblemContext(orgId, problemId);
  const owner = await resolveActor(orgId, { userContext: { userEmail: ownerUserEmail } });
  const cannotProceedReasons = [!roleCan(actor.role, "issues.assign") ? "Actor role cannot assign problems." : null].filter(Boolean);
  const prepared = await createActionRequest({
    orgId,
    actor,
    actionType: "assign_problem_owner",
    targetTable: "issues",
    targetId: problemId,
    payload: { problemId, ownerUserId: owner.userId, ownerUserEmail, willChange: [`Assign ${ownerUserEmail} as problem owner.`] },
    humanSummary: `Assign ${ownerUserEmail} to "${ctx.issue.title}".`,
    riskLevel: "LOW",
    cannotProceedReasons,
  });
  return jsonText(stableResponse({
    toolName: "prepare_assign_problem_owner",
    orgId,
    whatThisMeans: prepared.cannotProceedReasons.length > 0 ? "Owner assignment cannot proceed yet." : "Owner assignment is prepared and waiting for confirmation.",
    whyItMatters: "Ownership turns a detected problem into accountable remediation.",
    recommendedNextAction: prepared.cannotProceedReasons[0] ?? `Confirm with phrase: ${prepared.confirmationPhrase}`,
    data: prepared,
    sourceRecords: [sourceRecord("issues", ctx.issue.id, ctx.issue.title)],
  }));
}

async function prepareAddProblemComment(args) {
  const orgId = requireString(args, "orgId");
  const problemId = requireString(args, "problemId");
  const body = requireString(args, "body");
  const actor = await resolveActor(orgId, args);
  const ctx = await fetchProblemContext(orgId, problemId);
  const cannotProceedReasons = [!roleCan(actor.role, "issues.act") ? "Actor role cannot comment on problems." : null].filter(Boolean);
  const prepared = await createActionRequest({
    orgId,
    actor,
    actionType: "add_problem_comment",
    targetTable: "issue_comments",
    targetId: problemId,
    payload: { problemId, body, willChange: ["Add an internal problem comment."] },
    humanSummary: `Add a comment to "${ctx.issue.title}".`,
    riskLevel: "LOW",
    cannotProceedReasons,
  });
  return jsonText(stableResponse({
    toolName: "prepare_add_problem_comment",
    orgId,
    whatThisMeans: prepared.cannotProceedReasons.length > 0 ? "Problem comment cannot proceed yet." : "Problem comment is prepared and waiting for confirmation.",
    whyItMatters: "Problem comments become part of the remediation record.",
    recommendedNextAction: prepared.cannotProceedReasons[0] ?? `Confirm with phrase: ${prepared.confirmationPhrase}`,
    data: prepared,
    sourceRecords: [sourceRecord("issues", ctx.issue.id, ctx.issue.title)],
  }));
}

async function executePreparedAction(action) {
  const payload = action.payload ?? {};
  if (hashPayload(payload) !== action.payload_hash) {
    throw new McpInputError("Prepared action payload hash mismatch.", -32003);
  }
  if (action.action_type === "approve_decision") {
    const { error } = await supabase
      .from("approvals")
      .update({
        decision: "APPROVED",
        comment: payload.comment ?? null,
        decided_at: new Date().toISOString(),
      })
      .eq("id", payload.approvalId)
      .eq("org_id", action.org_id)
      .eq("decision", "PENDING");
    if (error) throw new Error(error.message);
    await supabase.from("change_timeline_events").insert({
      org_id: action.org_id,
      change_event_id: payload.decisionId,
      actor_user_id: action.actor_user_id,
      event_type: "MCP_APPROVAL_CONFIRMED",
      title: "Approval recorded via MCP",
      description: payload.comment ?? "Decision approved via Solvren MCP controlled action.",
      metadata: { action_request_id: action.id, approval_id: payload.approvalId },
    });
    return { table: "approvals", id: payload.approvalId, summary: "Approval marked APPROVED." };
  }
  if (action.action_type === "request_more_proof") {
    const { data, error } = await supabase
      .from("change_timeline_events")
      .insert({
        org_id: action.org_id,
        change_event_id: payload.decisionId,
        actor_user_id: action.actor_user_id,
        event_type: "MCP_PROOF_REQUESTED",
        title: "More proof requested via MCP",
        description: payload.message,
        metadata: { action_request_id: action.id },
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { table: "change_timeline_events", id: data.id, summary: "Proof request added to timeline." };
  }
  if (action.action_type === "attach_proof_link") {
    const { data, error } = await supabase
      .from("change_evidence")
      .insert({
        change_event_id: payload.decisionId,
        org_id: action.org_id,
        kind: payload.kind,
        label: payload.label,
        url: payload.url ?? null,
        note: payload.note ?? null,
        created_by: action.actor_user_id,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("change_timeline_events").insert({
      org_id: action.org_id,
      change_event_id: payload.decisionId,
      actor_user_id: action.actor_user_id,
      event_type: "MCP_EVIDENCE_PROVIDED",
      title: "Evidence added via MCP",
      description: `${payload.label || payload.kind} provided`,
      metadata: { action_request_id: action.id, evidence_id: data.id, evidence_kind: payload.kind },
    });
    return { table: "change_evidence", id: data.id, summary: "Proof link attached." };
  }
  if (action.action_type === "assign_problem_owner") {
    const { error } = await supabase
      .from("issues")
      .update({ owner_user_id: payload.ownerUserId, assigned_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", payload.problemId)
      .eq("org_id", action.org_id);
    if (error) throw new Error(error.message);
    return { table: "issues", id: payload.problemId, summary: `Problem assigned to ${payload.ownerUserEmail}.` };
  }
  if (action.action_type === "add_problem_comment") {
    const { data, error } = await supabase
      .from("issue_comments")
      .insert({
        issue_id: payload.problemId,
        author_user_id: action.actor_user_id,
        body: payload.body,
        visibility: "internal",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { table: "issue_comments", id: data.id, summary: "Problem comment added." };
  }
  throw new McpInputError(`Unsupported prepared action type: ${action.action_type}`, -32601);
}

async function confirmAction(args) {
  const orgId = requireString(args, "orgId");
  const actionId = requireString(args, "actionId");
  const confirmationPhrase = requireString(args, "confirmationPhrase");
  const actor = await resolveActor(orgId, args);
  await assertEffectiveMutationAllowed("confirm_action", orgId, args);
  const { data: action, error } = await supabase
    .from("mcp_action_requests")
    .select("*")
    .eq("id", actionId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!action) throw new McpInputError(`Prepared action not found: ${actionId}`, -32004);
  const rejectReasons = [
    action.status !== "PREPARED" ? `Action is ${action.status}, not PREPARED.` : null,
    action.actor_user_id !== actor.userId ? "Confirmation user does not match the user who prepared the action." : null,
    REQUIRE_CONFIRMATION && confirmationPhrase !== action.confirmation_phrase ? "Confirmation phrase does not match." : null,
    new Date(action.expires_at).getTime() < Date.now() ? "Prepared action has expired." : null,
  ].filter(Boolean);
  if (rejectReasons.length > 0) {
    await supabase.from("mcp_action_requests").update({ status: "REJECTED", confirmed_at: new Date().toISOString() }).eq("id", actionId);
    await writeMcpActionAudit({
      actionRequestId: actionId,
      orgId,
      actionType: action.action_type,
      targetTable: action.target_table,
      targetId: action.target_id,
      actorUserId: actor.userId,
      actorEmail: actor.userEmail,
      eventType: "CONFIRM",
      status: "REJECTED",
      reason: rejectReasons.join("; "),
      payloadHash: action.payload_hash,
    });
    throw new McpInputError(rejectReasons.join(" "), -32003);
  }
  await supabase.from("mcp_action_requests").update({ status: "CONFIRMED", confirmed_at: new Date().toISOString() }).eq("id", actionId);
  try {
    const result = await executePreparedAction(action);
    await supabase
      .from("mcp_action_requests")
      .update({ status: "EXECUTED", executed_at: new Date().toISOString(), result_summary: result.summary })
      .eq("id", actionId);
    await writeMcpActionAudit({
      actionRequestId: actionId,
      orgId,
      actionType: action.action_type,
      targetTable: action.target_table,
      targetId: action.target_id,
      actorUserId: actor.userId,
      actorEmail: actor.userEmail,
      eventType: "EXECUTE",
      status: "EXECUTED",
      payloadHash: action.payload_hash,
      afterSummary: result.summary,
    });
    return jsonText(stableResponse({
      toolName: "confirm_action",
      orgId,
      whatThisMeans: result.summary,
      whyItMatters: "The confirmed MCP action was executed and audit logged.",
      recommendedNextAction: "Review the updated Solvren record.",
      data: { actionId, actionType: action.action_type, result, mutatesData: true },
      sourceRecords: [sourceRecord(action.target_table, action.target_id, action.human_summary)],
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase.from("mcp_action_requests").update({ status: "FAILED", result_summary: message }).eq("id", actionId);
    await writeMcpActionAudit({
      actionRequestId: actionId,
      orgId,
      actionType: action.action_type,
      targetTable: action.target_table,
      targetId: action.target_id,
      actorUserId: actor.userId,
      actorEmail: actor.userEmail,
      eventType: "EXECUTE",
      status: "FAILED",
      reason: message,
      payloadHash: action.payload_hash,
    });
    throw err;
  }
}

const tools = {
  get_home_summary: {
    description: "Show the executive Solvren summary: money at risk, work needing action, problems, protected value, and setup health.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" } }, required: ["orgId"] },
    handler: getHomeSummary,
  },
  list_decisions_needing_action: {
    description: "List active revenue-impacting decisions that need review or completion.",
    inputSchema: {
      type: "object",
      properties: { orgId: { type: "string" }, limit: { type: "number", minimum: 1, maximum: 50 } },
      required: ["orgId"],
    },
    handler: listDecisionsNeedingAction,
  },
  get_decision: {
    description: "Get a CEO-readable decision detail: what happened, why it matters, next action, proof, approvals, and warnings.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, decisionId: { type: "string" } }, required: ["orgId", "decisionId"] },
    handler: getDecision,
  },
  list_open_problems: {
    description: "List open revenue problems, ordered by priority.",
    inputSchema: {
      type: "object",
      properties: { orgId: { type: "string" }, limit: { type: "number", minimum: 1, maximum: 50 } },
      required: ["orgId"],
    },
    handler: listOpenProblems,
  },
  get_problem: {
    description: "Get a CEO-readable problem detail: what happened, why it matters, owner, impact, actions, and sources.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, problemId: { type: "string" } }, required: ["orgId", "problemId"] },
    handler: getProblem,
  },
  get_proof_summary: {
    description: "Summarize protected value, prevented incidents, time saved, value stories, and available board-ready reports.",
    inputSchema: {
      type: "object",
      properties: { orgId: { type: "string" }, days: { type: "number", minimum: 7, maximum: 365 } },
      required: ["orgId"],
    },
    handler: getProofSummary,
  },
  generate_executive_brief: {
    description: "Generate a concise executive brief from current risk, action, setup, and proof context.",
    inputSchema: {
      type: "object",
      properties: { orgId: { type: "string" }, days: { type: "number", minimum: 7, maximum: 365 } },
      required: ["orgId"],
    },
    handler: generateExecutiveBrief,
  },
  get_setup_health: {
    description: "Show setup and instrumentation health in plain language: connected systems, gaps, onboarding status, and latest scan.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" } }, required: ["orgId"] },
    handler: getSetupHealth,
  },
  get_mcp_server_health: {
    description: "Show MCP server configuration health, enabled tools, read-only mode, audit status, and access guardrails.",
    inputSchema: { type: "object", properties: {} },
    handler: getMcpServerHealth,
  },
  get_mcp_data_freshness: {
    description: "Show when Solvren decision, problem, proof, setup, and scan data was last updated for an organization.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" } }, required: ["orgId"] },
    handler: getMcpDataFreshness,
  },
  get_mcp_policy: {
    description: "Show the effective customer MCP policy profile for this assistant deployment.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" } }, required: ["orgId"] },
    handler: getMcpPolicy,
  },
  explain_mcp_policy: {
    description: "Explain the MCP policy profile in plain English for admins and security reviewers.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" } }, required: ["orgId"] },
    handler: explainMcpPolicy,
  },
  list_mcp_policy_profiles: {
    description: "List customer-configured MCP assistant policy profiles for an organization.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" } }, required: ["orgId"] },
    handler: listMcpPolicyProfiles,
  },
  get_effective_mcp_permissions: {
    description: "Show the intersection of environment guardrails, customer policy, actor context, and Solvren permissions.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, userContext: { type: "object" } }, required: ["orgId"] },
    handler: getEffectiveMcpPermissions,
  },
  simulate_mcp_tool_call: {
    description: "Simulate whether a planned MCP tool call would be allowed by effective policy.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, toolName: { type: "string" }, arguments: { type: "object" }, userContext: { type: "object" } }, required: ["orgId", "toolName"] },
    handler: simulateMcpToolCall,
  },
  simulate_mcp_action: {
    description: "Simulate whether a controlled MCP write action would be allowed by effective policy.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, actionType: { type: "string" }, userContext: { type: "object" } }, required: ["orgId", "actionType"] },
    handler: simulateMcpAction,
  },
  explain_why_mcp_action_blocked: {
    description: "Explain why a controlled MCP action is blocked, without preparing or executing the action.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, actionType: { type: "string" }, userContext: { type: "object" } }, required: ["orgId", "actionType"] },
    handler: explainWhyMcpActionBlocked,
  },
  get_mcp_audit_summary: {
    description: "Summarize recent MCP action audit activity by status and action type.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, days: { type: "number", minimum: 1, maximum: 365 } }, required: ["orgId"] },
    handler: getMcpAuditSummary,
  },
  get_mcp_action_history: {
    description: "List recent MCP action audit events for enterprise review.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, limit: { type: "number", minimum: 1, maximum: 50 } }, required: ["orgId"] },
    handler: getMcpActionHistory,
  },
  generate_mcp_trust_report: {
    description: "Generate a security-reviewable MCP trust report covering policy and recent action audit activity.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, days: { type: "number", minimum: 1, maximum: 365 } }, required: ["orgId"] },
    handler: generateMcpTrustReport,
  },
  explain_decision_readiness: {
    description: "Explain whether a decision can be approved and what blocks it.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, decisionId: { type: "string" }, userContext: { type: "object" } }, required: ["orgId", "decisionId"] },
    handler: explainDecisionReadiness,
  },
  list_missing_proof: {
    description: "List required proof that is still missing for a decision.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, decisionId: { type: "string" } }, required: ["orgId", "decisionId"] },
    handler: listMissingProof,
  },
  list_pending_approvers: {
    description: "List pending approvers and missing approval lanes for a decision.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, decisionId: { type: "string" } }, required: ["orgId", "decisionId"] },
    handler: listPendingApprovers,
  },
  recommend_decision_next_step: {
    description: "Recommend the single next step for a revenue-impacting decision.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, decisionId: { type: "string" } }, required: ["orgId", "decisionId"] },
    handler: recommendDecisionNextStep,
  },
  recommend_problem_actions: {
    description: "Recommend practical actions to resolve a revenue problem.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, problemId: { type: "string" } }, required: ["orgId", "problemId"] },
    handler: recommendProblemActions,
  },
  summarize_problem_root_cause: {
    description: "Summarize the likely root cause and source context for a problem.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, problemId: { type: "string" } }, required: ["orgId", "problemId"] },
    handler: summarizeProblemRootCause,
  },
  list_related_decisions: {
    description: "List decisions linked to a problem.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, problemId: { type: "string" } }, required: ["orgId", "problemId"] },
    handler: listRelatedDecisions,
  },
  list_related_incidents: {
    description: "List incidents related to a problem.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, problemId: { type: "string" } }, required: ["orgId", "problemId"] },
    handler: listRelatedIncidents,
  },
  generate_board_brief: {
    description: "Generate a board-ready Markdown brief about exposure, action, and protected value.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, days: { type: "number", minimum: 7, maximum: 365 } }, required: ["orgId"] },
    handler: generateBoardBrief,
  },
  generate_decision_brief: {
    description: "Generate a structured Markdown brief for a decision.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, decisionId: { type: "string" } }, required: ["orgId", "decisionId"] },
    handler: generateDecisionBrief,
  },
  generate_problem_brief: {
    description: "Generate a structured Markdown brief for a problem.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, problemId: { type: "string" } }, required: ["orgId", "problemId"] },
    handler: generateProblemBrief,
  },
  generate_setup_gap_summary: {
    description: "Generate a Markdown setup gap summary.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" } }, required: ["orgId"] },
    handler: generateSetupGapSummary,
  },
  draft_approval_comment: {
    description: "Draft an approval or not-ready comment without mutating Solvren data.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, decisionId: { type: "string" }, userContext: { type: "object" } }, required: ["orgId", "decisionId"] },
    handler: draftApprovalComment,
  },
  draft_request_for_proof: {
    description: "Draft a request for missing proof without mutating Solvren data.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, decisionId: { type: "string" } }, required: ["orgId", "decisionId"] },
    handler: draftRequestForProof,
  },
  draft_owner_message: {
    description: "Draft an owner follow-up message for a problem without mutating Solvren data.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, problemId: { type: "string" } }, required: ["orgId", "problemId"] },
    handler: draftOwnerMessage,
  },
  draft_exec_update: {
    description: "Draft a short executive update without mutating Solvren data.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" } }, required: ["orgId"] },
    handler: draftExecUpdate,
  },
  recommend_next_setup_step: {
    description: "Recommend the single next setup step.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" } }, required: ["orgId"] },
    handler: recommendNextSetupStep,
  },
  explain_coverage_gap: {
    description: "Explain why a setup or instrumentation gap matters.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, gap: { type: "string" } }, required: ["orgId", "gap"] },
    handler: explainCoverageGap,
  },
  list_unprotected_revenue_surfaces: {
    description: "List standard revenue surfaces that appear under-instrumented.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" } }, required: ["orgId"] },
    handler: listUnprotectedRevenueSurfaces,
  },
  prepare_approve_decision: {
    description: "Prepare, but do not execute, an approval for a decision. Requires controlled_write mode and confirmation.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, decisionId: { type: "string" }, approvalId: { type: "string" }, comment: { type: "string" }, userContext: { type: "object" } }, required: ["orgId", "decisionId", "userContext"] },
    handler: prepareApproveDecision,
  },
  prepare_request_more_proof: {
    description: "Prepare, but do not execute, a visible request for more proof on a decision.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, decisionId: { type: "string" }, message: { type: "string" }, userContext: { type: "object" } }, required: ["orgId", "decisionId", "userContext"] },
    handler: prepareRequestMoreProof,
  },
  prepare_attach_proof_link: {
    description: "Prepare, but do not execute, attaching a proof link to a decision.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, decisionId: { type: "string" }, kind: { type: "string" }, label: { type: "string" }, url: { type: "string" }, note: { type: "string" }, userContext: { type: "object" } }, required: ["orgId", "decisionId", "kind", "label", "userContext"] },
    handler: prepareAttachProofLink,
  },
  prepare_assign_problem_owner: {
    description: "Prepare, but do not execute, assigning a problem owner.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, problemId: { type: "string" }, ownerUserEmail: { type: "string" }, userContext: { type: "object" } }, required: ["orgId", "problemId", "ownerUserEmail", "userContext"] },
    handler: prepareAssignProblemOwner,
  },
  prepare_add_problem_comment: {
    description: "Prepare, but do not execute, adding an internal problem comment.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, problemId: { type: "string" }, body: { type: "string" }, userContext: { type: "object" } }, required: ["orgId", "problemId", "body", "userContext"] },
    handler: prepareAddProblemComment,
  },
  confirm_action: {
    description: "Confirm and execute a prepared MCP action. This is the only Phase 3 tool that mutates data.",
    inputSchema: { type: "object", properties: { orgId: { type: "string" }, actionId: { type: "string" }, confirmationPhrase: { type: "string" }, userContext: { type: "object" } }, required: ["orgId", "actionId", "confirmationPhrase", "userContext"] },
    handler: confirmAction,
  },
};

function toolList() {
  return Object.entries(tools)
    .filter(([name]) => ALLOWED_TOOLS.size === 0 || ALLOWED_TOOLS.has(name))
    .map(([name, tool]) => ({
      name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
}

async function handle(request) {
  const { id, method, params } = request;
  assertReadOnlyMode();
  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: params?.protocolVersion ?? "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      },
    };
  }
  if (method === "tools/list") return { jsonrpc: "2.0", id, result: { tools: toolList() } };
  if (method === "tools/call") {
    const startedAt = Date.now();
    const requestId = requestIdFrom(id);
    const name = params?.name;
    const tool = tools[name];
    const args = params?.arguments ?? {};
    const orgId = extractOrgId(args);
    try {
      if (!tool) throw new McpInputError(`Unknown tool: ${name}`, -32601);
      await assertEffectiveToolAllowed(name, args);
      const result = await tool.handler(args);
      const payload = JSON.parse(result.content[0].text);
      const data = payload?.data;
      const resultCount = Array.isArray(data)
        ? data.length
        : typeof data === "object" && data
          ? Object.values(data).filter((value) => Array.isArray(value)).reduce((sum, value) => sum + value.length, 0)
          : null;
      auditToolCall({ requestId, toolName: name, orgId, status: "ok", resultCount, startedAt });
      return { jsonrpc: "2.0", id, result };
    } catch (error) {
      auditToolCall({
        requestId,
        toolName: name,
        orgId,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
        startedAt,
      });
      throw error;
    }
  }
  if (id == null) return null;
  throw new McpInputError(`Unsupported method: ${method}`, -32601);
}

function respond(message) {
  if (!message) return;
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", async (line) => {
  if (!line.trim()) return;
  let request;
  try {
    request = JSON.parse(line);
    respond(await handle(request));
  } catch (error) {
    const id = request?.id ?? null;
    respond({
      jsonrpc: "2.0",
      id,
      error: {
        code: error instanceof McpInputError ? error.code : -32603,
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
});

process.stderr.write(`${SERVER_NAME} MCP server ready\n`);
