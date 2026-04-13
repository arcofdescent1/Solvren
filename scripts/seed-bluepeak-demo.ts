#!/usr/bin/env npx tsx
/**
 * BluePeak Home Services — sales demo org (service role).
 *
 * Idempotent: deletes org by slug `bluepeak-home-services`, removes demo auth users,
 * then recreates org, members, integrations, issues, changes, tasks, comments, metrics.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (.env.local loaded when present)
 *
 * Usage: npx tsx scripts/seed-bluepeak-demo.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "node:crypto";
import type { IntegrationProvider } from "../src/modules/integrations/contracts/types";
import { getRegistryManifest, hasProvider } from "../src/modules/integrations/registry/providerRegistry";
import { enableDomainForOrg } from "../src/services/domains/enableDomainForOrg";
import { initializeOnboarding } from "../src/modules/onboarding/services/onboarding-engine.service";
import { upsertOrgOnboardingState } from "../src/modules/onboarding/repositories/org-onboarding-states.repository";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) {
        const key = m[1].trim();
        const val = m[2].trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_SLUG = "bluepeak-home-services";
const DEMO_SCENARIO_KEY = "bluepeak-home-services";
const ORG_NAME = "BluePeak Home Services";
const EMAIL_DOMAIN = "bluepeak-demo.solvren.test";
const PASSWORD = "BluePeakDemo2026!";

const DEMO_EMAIL_SUFFIX = `@${EMAIL_DOMAIN}`;

/** Lightweight registry for future SaaS / healthcare variants (v1: single scenario). */
export const BLUEPEAK_SCENARIO = {
  key: DEMO_SCENARIO_KEY,
  displayName: "BluePeak Home Services — Executive Demo",
  version: "1.0.0",
} as const;

type Persona = {
  local: string;
  displayName: string;
  role: "owner" | "admin" | "reviewer" | "submitter" | "viewer";
  department?: string | null;
};

const PERSONAS: Persona[] = [
  { local: "olivia.martinez", displayName: "Olivia Martinez", role: "owner", department: "Executive" },
  { local: "michael.turner", displayName: "Michael Turner", role: "admin", department: "Executive" },
  { local: "rachel.brooks", displayName: "Rachel Brooks", role: "reviewer", department: "Sales" },
  { local: "daniel.price", displayName: "Daniel Price", role: "reviewer", department: "Finance" },
  { local: "sarah.chen", displayName: "Sarah Chen", role: "admin", department: "RevOps" },
  { local: "marcus.lee", displayName: "Marcus Lee", role: "admin", department: "Engineering" },
  { local: "priya.nair", displayName: "Priya Nair", role: "submitter", department: "Engineering" },
  { local: "jason.patel", displayName: "Jason Patel", role: "submitter", department: "Operations" },
  { local: "emily.rogers", displayName: "Emily Rogers", role: "submitter", department: "RevOps" },
  { local: "lauren.kim", displayName: "Lauren Kim", role: "reviewer", department: "Customer Success" },
  { local: "david.ross", displayName: "David Ross", role: "reviewer", department: "Sales" },
  { local: "brooke.adams", displayName: "Brooke Adams", role: "viewer", department: "Sales" },
  { local: "kevin.sullivan", displayName: "Kevin Sullivan", role: "submitter", department: "Engineering" },
  { local: "demo.admin", displayName: "Demo Admin", role: "admin", department: "RevOps" },
  { local: "alex.morgan", displayName: "Alex Morgan", role: "viewer", department: "Finance" },
  { local: "jordan.lee", displayName: "Jordan Lee", role: "viewer", department: "Marketing" },
  { local: "taylor.reed", displayName: "Taylor Reed", role: "viewer", department: "Marketing" },
  { local: "casey.nguyen", displayName: "Casey Nguyen", role: "viewer", department: "Operations" },
  { local: "riley.carter", displayName: "Riley Carter", role: "viewer", department: "Call Center" },
  { local: "jamie.ortiz", displayName: "Jamie Ortiz", role: "viewer", department: "Call Center" },
];

function email(local: string) {
  return `${local}${DEMO_EMAIL_SUFFIX}`.toLowerCase();
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

async function deleteExistingDemo(admin: SupabaseClient) {
  const { data: orgRow } = await admin.from("organizations").select("id").eq("slug", DEMO_SLUG).maybeSingle();
  if (!orgRow?.id) {
    await purgeDemoUsers(admin);
    return;
  }
  const orgId = orgRow.id as string;

  const { data: members } = await admin.from("organization_members").select("user_id").eq("org_id", orgId);
  const userIds = [...new Set((members ?? []).map((m: { user_id: string }) => m.user_id))];

  const { error: delOrgErr } = await admin.from("organizations").delete().eq("id", orgId);
  if (delOrgErr) throw delOrgErr;

  for (const uid of userIds) {
    const { data: u } = await admin.auth.admin.getUserById(uid);
    const em = u.user?.email?.toLowerCase() ?? "";
    if (em.endsWith(DEMO_EMAIL_SUFFIX)) {
      await admin.auth.admin.deleteUser(uid);
    }
  }
}

async function purgeDemoUsers(admin: SupabaseClient) {
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data.users.filter((u) => (u.email ?? "").toLowerCase().endsWith(DEMO_EMAIL_SUFFIX));
    for (const u of users) {
      await admin.auth.admin.deleteUser(u.id);
    }
    if (data.users.length < perPage) break;
    page += 1;
  }
}

async function listAllAuthUsers(admin: SupabaseClient) {
  const out: { id: string; email: string }[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) {
      if (u.email) out.push({ id: u.id, email: u.email.toLowerCase() });
    }
    if (data.users.length < 200) break;
    page += 1;
  }
  return out;
}

async function ensureUsers(admin: SupabaseClient): Promise<Record<string, string>> {
  const existing = new Map((await listAllAuthUsers(admin)).map((u) => [u.email, u.id]));
  const out: Record<string, string> = {};
  for (const p of PERSONAS) {
    const addr = email(p.local);
    const found = existing.get(addr);
    if (found) {
      await admin.auth.admin.updateUserById(found, {
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: p.displayName },
      });
      out[addr] = found;
    } else {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: addr,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: p.displayName },
      });
      if (error) throw error;
      out[addr] = created.user!.id;
      existing.set(addr, created.user!.id);
    }
  }
  return out;
}

function integrationRow(
  orgId: string,
  provider: string,
  installedBy: string,
  health: { tier: "healthy" | "warning" | "critical"; message: string }
) {
  const now = new Date().toISOString();
  const status = "connected" as const;
  const demoStatus = health.tier;
  return {
    org_id: orgId,
    provider,
    display_name: provider === "chilipiper" ? "Chili Piper" : provider.charAt(0).toUpperCase() + provider.slice(1),
    category: "crm",
    auth_type: "oauth2",
    status,
    connection_mode: "manual" as const,
    installed_by_user_id: installedBy,
    installed_at: now,
    disconnected_at: null as string | null,
    last_success_at: now,
    last_error_at: health.tier === "critical" ? now : null,
    last_error_code: health.tier === "critical" ? "ROUTING_FAILURE" : null,
    last_error_message: health.message,
    health_summary_json: {
      overall: demoStatus,
      demo_health: demoStatus,
      demo_health_message: health.message,
      last_sync_at: now,
    },
    scopes_granted_json: [],
    scopes_missing_json: [],
    config_json: { demo: true, sandbox: true },
    secrets_ref: null as string | null,
    metadata_json: { bluepeak_demo: true, demo_health: demoStatus },
  };
}

async function seedRegistryIntegrations(admin: SupabaseClient, orgId: string, ownerId: string) {
  const phase1: IntegrationProvider[] = ["hubspot", "salesforce", "stripe", "slack", "jira", "netsuite"];
  const healthByProvider: Record<string, { tier: "healthy" | "warning" | "critical"; message: string }> = {
    hubspot: { tier: "healthy", message: "Sync healthy; webhooks flowing." },
    salesforce: { tier: "warning", message: "Field mismatch detected on Industry picklist." },
    stripe: { tier: "healthy", message: "Payments API reachable; webhooks verified." },
    slack: { tier: "healthy", message: "Workspace linked; delivery healthy." },
    jira: { tier: "healthy", message: "Jira Cloud linked; issue sync nominal." },
    netsuite: { tier: "healthy", message: "Sandbox connection; no live ERP writes." },
  };

  for (const provider of phase1) {
    if (!hasProvider(provider)) continue;
    const m = getRegistryManifest(provider);
    const h = healthByProvider[provider] ?? { tier: "healthy", message: "Seeded demo health." };
    const row = {
      org_id: orgId,
      provider,
      display_name: m.displayName,
      category: m.category,
      auth_type: m.authType,
      status: "connected" as const,
      connection_mode: "manual" as const,
      installed_by_user_id: ownerId,
      installed_at: new Date().toISOString(),
      disconnected_at: null as string | null,
      last_success_at: new Date().toISOString(),
      last_error_at: h.tier === "critical" ? new Date().toISOString() : null,
      last_error_code: h.tier === "critical" ? "DEMO_ALERT" : null,
      last_error_message: h.message,
      health_summary_json: { overall: h.tier, demo_health: h.tier, demo_health_message: h.message },
      scopes_granted_json: [],
      scopes_missing_json: [],
      config_json: { demo: true },
      secrets_ref: null as string | null,
      metadata_json: { bluepeak_demo: true },
    };
    const { error } = await admin.from("integration_accounts").upsert(row, { onConflict: "org_id,provider" });
    if (error) console.warn("integration_accounts", provider, error.message);
  }

  if (hasProvider("snowflake")) {
    const m = getRegistryManifest("snowflake");
    const row = {
      org_id: orgId,
      provider: "snowflake",
      display_name: m.displayName,
      category: m.category,
      auth_type: m.authType,
      status: "connected" as const,
      connection_mode: "manual" as const,
      installed_by_user_id: ownerId,
      installed_at: new Date().toISOString(),
      health_summary_json: { overall: "healthy", demo_health: "healthy", demo_health_message: "Warehouse reachable (demo)." },
      scopes_granted_json: [],
      scopes_missing_json: [],
      config_json: { demo: true },
      secrets_ref: null as string | null,
      metadata_json: { bluepeak_demo: true },
    };
    await admin.from("integration_accounts").upsert(row, { onConflict: "org_id,provider" });
  }

  const chili = integrationRow(orgId, "chilipiper", ownerId, {
    tier: "critical",
    message: "West region HVAC lead routing stalled after April 4 rule change.",
  });
  chili.display_name = "Chili Piper";
  chili.category = "scheduling";
  const { error: chErr } = await admin.from("integration_accounts").upsert(chili, { onConflict: "org_id,provider" });
  if (chErr) console.warn("chilipiper account", chErr.message);
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("BluePeak demo seed");
  console.log("==================");
  await deleteExistingDemo(admin);
  const userIdsByEmail = await ensureUsers(admin);

  const ownerId = userIdsByEmail[email("olivia.martinez")];
  const sarahId = userIdsByEmail[email("sarah.chen")];
  const marcusId = userIdsByEmail[email("marcus.lee")];
  const priyaId = userIdsByEmail[email("priya.nair")];
  const demoAdminId = userIdsByEmail[email("demo.admin")];

  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({
      name: ORG_NAME,
      slug: DEMO_SLUG,
      demo_slug: DEMO_SLUG,
      is_demo: true,
      created_by: ownerId,
      industry: "home_services",
      company_size: "1000_plus",
      primary_domain: EMAIL_DOMAIN,
      demo_profile: {
        employee_count: 1250,
        annual_revenue: 185_000_000,
        industry: "home_services",
        narrative:
          "Multi-state HVAC, plumbing, electrical, and pest control — Spring Service Plan campaign stress.",
      },
    })
    .select("id")
    .single();
  if (orgErr || !org) throw orgErr ?? new Error("org insert failed");
  const orgId = org.id as string;

  for (const p of PERSONAS) {
    const addr = email(p.local);
    const uid = userIdsByEmail[addr];
    const { error } = await admin.from("organization_members").insert({
      org_id: orgId,
      user_id: uid,
      role: p.role,
      department: p.department ?? null,
    });
    if (error) throw error;
  }

  await admin.from("organization_settings").upsert(
    {
      org_id: orgId,
      timezone: "America/Los_Angeles",
      primary_notification_email: email("sarah.chen"),
      require_evidence_before_approval: true,
    },
    { onConflict: "org_id" }
  );

  await admin.from("org_demo_config").upsert(
    {
      org_id: orgId,
      is_demo_org: true,
      demo_scenario_key: DEMO_SCENARIO_KEY,
      demo_reset_allowed: true,
      demo_external_write_disabled: true,
      last_reset_at: new Date().toISOString(),
    },
    { onConflict: "org_id" }
  );

  await admin.from("billing_accounts").upsert(
    {
      org_id: orgId,
      plan_key: "ENTERPRISE",
      status: "ACTIVE",
      stripe_customer_id: `cus_demo_${DEMO_SLUG.replace(/-/g, "_")}`,
    },
    { onConflict: "org_id" }
  );

  await enableDomainForOrg(admin, { orgId, domainKey: "REVENUE" });
  await initializeOnboarding(admin, orgId);
  const { error: skipGuidedErr } = await upsertOrgOnboardingState(admin, {
    orgId,
    guidedPhase1Status: "SKIPPED",
  });
  if (skipGuidedErr) throw skipGuidedErr;

  await seedRegistryIntegrations(admin, orgId, ownerId);

  const { data: model } = await admin
    .from("impact_models")
    .select("id, model_key, model_version")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!model) throw new Error("No active impact_models row (run migrations).");
  const modelId = (model as { id: string }).id;
  const modelKey = String((model as { model_key: string }).model_key);
  const modelVersion = String((model as { model_version: string }).model_version);

  /** --- Change events (governance path) --- */
  const changeChiliId = randomUUID();
  const changePricingId = randomUUID();

  const baseChange = {
    org_id: orgId,
    change_type: "OTHER" as const,
    domain: "REVENUE" as const,
    intake: {},
    systems_involved: [] as string[],
    revenue_impact_areas: [] as string[],
    impacts_active_customers: true,
    alters_pricing_visibility: false,
    backfill_required: false,
    data_migration_required: false,
    requires_code_deploy: false,
    reversible_via_config: true,
    requires_db_restore: false,
    requires_manual_data_correction: false,
    created_by: sarahId,
    submitted_at: daysAgo(4),
    deleted_at: null as string | null,
  };

  const { error: c1e } = await admin.from("change_events").insert({
    ...baseChange,
    id: changeChiliId,
    title: "Chili Piper routing rule change — west HVAC territories",
    status: "IN_REVIEW",
    revenue_surface: "OTHER",
    estimated_mrr_affected: 405_000,
    revenue_risk_score: 0.92,
    sla_status: "OVERDUE",
    due_at: daysAgo(1),
    escalated_at: daysAgo(3),
  });
  if (c1e) throw c1e;

  const { error: c2e } = await admin.from("change_events").insert({
    ...baseChange,
    id: changePricingId,
    title: "Pricing engine release — annual plan discount configuration",
    status: "IN_REVIEW",
    revenue_surface: "PRICING",
    estimated_mrr_affected: 620_000,
    revenue_risk_score: 0.88,
    sla_status: "DUE_SOON",
    due_at: daysAgo(-2),
    created_by: marcusId,
    submitted_at: daysAgo(6),
  });
  if (c2e) throw c2e;

  await admin.from("impact_assessments").insert([
    {
      change_event_id: changeChiliId,
      domain: "REVENUE",
      schema_version: "pass_a_v1",
      status: "READY" as const,
      risk_score_raw: 92,
      risk_bucket: "CRITICAL",
      pass_a_output: {
        revenue_at_risk_by_department: { RevOps: 1_244_000, Billing: 586_000, Marketing: 0 },
        concentration_revops_billing_pct: 68,
      },
      pass_a_model: "demo_seed",
      pass_a_ran_at: daysAgo(3),
    },
    {
      change_event_id: changePricingId,
      domain: "REVENUE",
      schema_version: "pass_a_v1",
      status: "READY" as const,
      risk_score_raw: 88,
      risk_bucket: "HIGH",
      pass_a_output: { note: "Misconfigured discount ladder post-deploy." },
      pass_a_model: "demo_seed",
      pass_a_ran_at: daysAgo(5),
    },
  ]);

  await admin.from("risk_assessment_outputs").insert([
    {
      org_id: orgId,
      change_event_id: changeChiliId,
      base_risk_score: 0.9,
      exposure_score: 92,
      risk_bucket: "CRITICAL",
      exposure_bucket: "HIGH",
      revenue_surface_multiplier: 1.1,
      mrr_multiplier: 1.05,
      customer_multiplier: 1,
      top_signal_drivers: [{ key: "routing_failure", weight: 0.6 }],
    },
    {
      org_id: orgId,
      change_event_id: changePricingId,
      base_risk_score: 0.85,
      exposure_score: 88,
      risk_bucket: "HIGH",
      exposure_bucket: "HIGH",
      revenue_surface_multiplier: 1.2,
      mrr_multiplier: 1.1,
      customer_multiplier: 1,
      top_signal_drivers: [{ key: "pricing_config", weight: 0.55 }],
    },
  ]);

  await admin.from("risk_signals").insert([
    {
      change_event_id: changeChiliId,
      domain: "REVENUE",
      category: "AUTOMATION_INTEGRATION",
      signal_key: "lead_routing_gap",
      value_type: "TEXT",
      value_text: "Obsolete territory field referenced in Chili Piper router",
      rationale: "Post April-4 deploy, HVAC leads from CA/OR/WA unassigned.",
      confidence: 0.9,
      reasons: [],
      source: "DEMO_SEED",
      weight_at_time: 10,
      contribution: 10,
      created_by: sarahId,
    },
    {
      change_event_id: changeChiliId,
      domain: "REVENUE",
      category: "CUSTOMER_IMPACT",
      signal_key: "abandoned_high_intent_leads",
      value_type: "NUMBER",
      value_num: 117,
      rationale: "High-intent leads not assigned within SLA.",
      confidence: 0.85,
      reasons: [],
      source: "DEMO_SEED",
      weight_at_time: 8,
      contribution: 8,
      created_by: sarahId,
    },
    {
      change_event_id: changePricingId,
      domain: "REVENUE",
      category: "FINANCIAL_EXPOSURE",
      signal_key: "discount_misconfiguration",
      value_type: "TEXT",
      value_text: "Annual plan discount widened from 10% to 40%",
      rationale: "Config drift in pricing service.",
      confidence: 0.88,
      reasons: [],
      source: "DEMO_SEED",
      weight_at_time: 9,
      contribution: 9,
      created_by: marcusId,
    },
  ]);

  await admin.from("sla_events").insert([
    {
      org_id: orgId,
      change_event_id: changeChiliId,
      previous_state: "ON_TRACK",
      new_state: "OVERDUE",
      triggered_by: sarahId,
      triggered_source: "SYSTEM",
    },
    {
      org_id: orgId,
      change_event_id: changeChiliId,
      previous_state: "OVERDUE",
      new_state: "ESCALATED",
      triggered_by: sarahId,
      triggered_source: "USER",
    },
    {
      org_id: orgId,
      change_event_id: changePricingId,
      previous_state: "ON_TRACK",
      new_state: "DUE_SOON",
      triggered_by: marcusId,
      triggered_source: "SYSTEM",
    },
  ]);

  await admin.from("change_evidence").insert([
    {
      org_id: orgId,
      change_event_id: changeChiliId,
      kind: "screenshot",
      label: "Chili Piper routing mismatch",
      url: null,
      note: "Territory field mismatch vs HubSpot region picklist.",
      created_by: sarahId,
    },
    {
      org_id: orgId,
      change_event_id: changePricingId,
      kind: "document",
      label: "Discount ladder diff",
      url: null,
      note: "Before/after JSON diff from pricing service.",
      created_by: marcusId,
    },
  ]);

  await admin.from("change_timeline_events").insert([
    {
      org_id: orgId,
      change_event_id: changeChiliId,
      actor_user_id: sarahId,
      event_type: "COMMENT",
      title: "Rule change correlated with spike",
      description: "We think this started after the April 4 routing update.",
      metadata: {},
    },
    {
      org_id: orgId,
      change_event_id: changeChiliId,
      actor_user_id: marcusId,
      event_type: "STATUS",
      title: "Engineering triage",
      description: "Hotfix drafted; pending approval.",
      metadata: {},
    },
    {
      org_id: orgId,
      change_event_id: changePricingId,
      actor_user_id: marcusId,
      event_type: "COMMENT",
      title: "Release correlation",
      description: "Discount bug aligns with release 2026.04.02.",
      metadata: {},
    },
  ]);

  await admin.from("jira_issue_links").insert([
    {
      org_id: orgId,
      change_event_id: changeChiliId,
      jira_issue_id: "10042",
      jira_issue_key: "REV-2042",
      jira_project_key: "REV",
    },
    {
      org_id: orgId,
      change_event_id: changePricingId,
      jira_issue_id: "10043",
      jira_issue_key: "REV-2043",
      jira_project_key: "REV",
    },
  ]);

  const danielId = userIdsByEmail[email("daniel.price")];
  const rachelId = userIdsByEmail[email("rachel.brooks")];

  await admin.from("approvals").insert([
    {
      org_id: orgId,
      change_event_id: changePricingId,
      domain: "REVENUE",
      approver_user_id: danielId,
      approval_area: "Finance",
      decision: "PENDING",
    },
    {
      org_id: orgId,
      change_event_id: changePricingId,
      domain: "REVENUE",
      approver_user_id: rachelId,
      approval_area: "Revenue",
      decision: "PENDING",
    },
    {
      org_id: orgId,
      change_event_id: changeChiliId,
      domain: "REVENUE",
      approver_user_id: sarahId,
      approval_area: "Operations",
      decision: "PENDING",
    },
  ]);

  /** --- Issues --- */
  const issueChili = await insertIssue(admin, {
    orgId,
    key: "BP-9001",
    title: "West Region HVAC Leads Not Assigned",
    summary: "Chili Piper routing failure — 642 leads affected; $486k ARR at risk.",
    severity: "critical",
    status: "in_progress",
    domainKey: "revenue",
    sourceType: "integration_event",
    sourceRef: `chilipiper:${changeChiliId}`,
    ownerUserId: sarahId,
    ownerTeamKey: "revops",
    openedDaysAgo: 4,
    createdBy: sarahId,
  });

  const issuePricing = await insertIssue(admin, {
    orgId,
    key: "BP-9002",
    title: "Pricing release bug — annual plan discounts widened incorrectly",
    summary: "Engineering release increased annual plan discounts from 10% to 40%.",
    severity: "critical",
    status: "assigned",
    domainKey: "revenue",
    sourceType: "change",
    sourceRef: changePricingId,
    ownerUserId: marcusId,
    ownerTeamKey: "engineering",
    openedDaysAgo: 6,
    createdBy: marcusId,
  });

  const issueDup = await insertIssue(admin, {
    orgId,
    key: "BP-9003",
    title: "Marketing campaign created 18,432 duplicate contacts",
    summary: "HubSpot + Salesforce sync collision after webinar campaign.",
    severity: "critical",
    status: "in_progress",
    domainKey: "revenue",
    sourceType: "detector",
    sourceRef: "hubspot_sf_dup:webinar-2026-04",
    ownerUserId: userIdsByEmail[email("emily.rogers")],
    ownerTeamKey: "revops",
    openedDaysAgo: 5,
    createdBy: userIdsByEmail[email("rachel.brooks")],
  });

  const issueStripe = await insertIssue(admin, {
    orgId,
    key: "BP-9004",
    title: "Stripe renewal failures not entering recovery workflow",
    summary: "173 failed renewals; HubSpot recovery sequence not firing.",
    severity: "critical",
    status: "triaged",
    domainKey: "revenue",
    sourceType: "integration_event",
    sourceRef: "stripe:renewal_recovery_gap",
    ownerUserId: danielId,
    ownerTeamKey: "billing",
    openedDaysAgo: 3,
    createdBy: danielId,
  });

  await admin.from("change_issue_links").insert([
    { change_id: changeChiliId, issue_id: issueChili, link_type: "origin" },
    { change_id: changePricingId, issue_id: issuePricing, link_type: "origin" },
  ]);

  const secondarySpecs = [
    {
      key: "BP-9010",
      title: "Salesforce field mismatch — enterprise opportunities missing industry",
      sev: "high" as const,
      st: "assigned" as const,
      team: "revops",
      owner: userIdsByEmail[email("emily.rogers")],
    },
    {
      key: "BP-9011",
      title: "NetSuite invoice sync delay — 38 customers flagged delinquent incorrectly",
      sev: "high" as const,
      st: "triaged" as const,
      team: "billing",
      owner: danielId,
    },
    {
      key: "BP-9012",
      title: "Slack alert integration flapping for engineering incidents channel",
      sev: "medium" as const,
      st: "assigned" as const,
      team: "engineering",
      owner: priyaId,
    },
    {
      key: "BP-9013",
      title: "Zendesk queue backlog — tickets over SLA (assignment)",
      sev: "medium" as const,
      st: "triaged" as const,
      team: "revops",
      owner: userIdsByEmail[email("lauren.kim")],
    },
    {
      key: "BP-9014",
      title: "Marketing nurture paused after HubSpot form field rename",
      sev: "medium" as const,
      st: "open" as const,
      team: "revops",
      owner: userIdsByEmail[email("jordan.lee")],
    },
    {
      key: "BP-9015",
      title: "Finance warehouse job failed — executive MRR dashboard inconsistent",
      sev: "high" as const,
      st: "assigned" as const,
      team: "billing",
      owner: danielId,
    },
    {
      key: "BP-9016",
      title: "West call center staffing — appointment rate down 18% WoW",
      sev: "medium" as const,
      st: "open" as const,
      team: "revops",
      owner: userIdsByEmail[email("david.ross")],
    },
  ];

  const secondaryIds: string[] = [];
  for (const s of secondarySpecs) {
    const id = await insertIssue(admin, {
      orgId,
      key: s.key,
      title: s.title,
      summary: s.title,
      severity: s.sev,
      status: s.st,
      domainKey: "revenue",
      sourceType: "manual",
      sourceRef: `demo:${s.key}`,
      ownerUserId: s.owner,
      ownerTeamKey: s.team,
      openedDaysAgo: 7,
      createdBy: demoAdminId,
    });
    secondaryIds.push(id);
  }

  const resolvedSpecs = [
    {
      key: "BP-8001",
      title: "Appointment reminder workflow outage restored",
      summary: "Twilio segment retry storm; bookings recovered.",
      recovered: 118_000,
      days: 21,
    },
    {
      key: "BP-8002",
      title: "Dispatch board API rate limit mitigated",
      summary: "Added backoff + cache; p95 latency normalized.",
      recovered: 54_000,
      days: 35,
    },
  ];
  const resolvedIds: string[] = [];
  for (const r of resolvedSpecs) {
    const id = await insertIssue(admin, {
      orgId,
      key: r.key,
      title: r.title,
      summary: r.summary,
      severity: "high",
      status: "verified",
      domainKey: "revenue",
      sourceType: "manual",
      sourceRef: `demo:resolved:${r.key}`,
      ownerUserId: sarahId,
      ownerTeamKey: "revops",
      openedDaysAgo: r.days,
      createdBy: sarahId,
      resolvedDaysAgo: 4,
      verifiedDaysAgo: 3,
    });
    resolvedIds.push(id);
    await admin.from("issue_impact_assessments").insert({
      issue_id: id,
      model_key: "demo.resolution_summary",
      model_version: "1.0",
      direct_revenue_loss: 0,
      revenue_at_risk: 0,
      customer_count_affected: 0,
      operational_cost_estimate: 0,
      confidence_score: 0.9,
      assumptions_json: { recovered_revenue: r.recovered },
      calculated_at: daysAgo(3),
    });
  }

  /** Impact quantifications + summaries for headline issues */
  await upsertIssueImpactFromDemo(admin, {
    orgId,
    modelId,
    modelKey,
    modelVersion,
    issueId: issueChili,
    revenueAtRisk: 486_000,
    loss: 120_000,
  });
  await upsertIssueImpactFromDemo(admin, {
    orgId,
    modelId,
    modelKey,
    modelVersion,
    issueId: issueDup,
    revenueAtRisk: 1_200_000,
    loss: 50_000,
  });
  await upsertIssueImpactFromDemo(admin, {
    orgId,
    modelId,
    modelKey,
    modelVersion,
    issueId: issueStripe,
    revenueAtRisk: 92_400,
    loss: 12_000,
  });

  /** Stripe affected accounts (issue_entities) */
  for (let i = 0; i < 15; i++) {
    await admin.from("issue_entities").insert({
      issue_id: issueStripe,
      entity_type: "stripe_customer",
      external_system: "stripe",
      external_object_type: "customer",
      external_id: `cus_bp_demo_${i}`,
      entity_display_name: `BluePeak Demo Customer ${i + 1}`,
      metadata_json: { mrr: 450 + i * 30, renewal_failed_at: daysAgo(2) },
    });
  }

  /** Duplicate issue evidence + risk_events (no legacy risk_signals without change) */
  await admin.from("issue_sources").insert({
    issue_id: issueDup,
    source_type: "hubspot",
    source_ref: "webinar_campaign_2026_04",
    evidence_json: { duplicate_rate_14d: "up 312%", systems: ["hubspot", "salesforce"] },
  });
  await admin.from("risk_events").insert({
    org_id: orgId,
    provider: "hubspot",
    object: "contact",
    object_id: "dup-cluster-001",
    field: "email",
    risk_type: "duplicate_burst",
    risk_score: 88,
    risk_bucket: "HIGH",
    impact_amount: 1_200_000,
    change_event_id: null,
    approved_at: null,
    timestamp: daysAgo(2),
    metadata: { issue_id: issueDup, narrative: "Webinar list import collision" },
  });

  /** RevOps queue slice: 4 assigned, 2 triaged, 1 overdue (linked to overdue change) */
  const revopsAssigned = await Promise.all(
    [0, 1, 2, 3].map((i) =>
      insertIssue(admin, {
        orgId,
        key: `BP-RV-${10 + i}`,
        title: `RevOps queue item ${i + 1} — routing backlog`,
        summary: "Supporting Spring Service Plan surge.",
        severity: "medium",
        status: "assigned",
        domainKey: "revenue",
        sourceType: "manual",
        sourceRef: `demo:revops:${i}`,
        ownerUserId: sarahId,
        ownerTeamKey: "revops",
        openedDaysAgo: 2,
        createdBy: sarahId,
      })
    )
  );
  await Promise.all(
    [0, 1].map((i) =>
      insertIssue(admin, {
        orgId,
        key: `BP-RV-T${i}`,
        title: `RevOps awaiting approval ${i + 1}`,
        summary: "Pending leadership sign-off on mitigation.",
        severity: "medium",
        status: "triaged",
        domainKey: "revenue",
        sourceType: "manual",
        sourceRef: `demo:revops-triage:${i}`,
        ownerUserId: sarahId,
        ownerTeamKey: "revops",
        openedDaysAgo: 1,
        createdBy: sarahId,
      })
    )
  );
  const revOverdue = await insertIssue(admin, {
    orgId,
    key: "BP-RV-OD",
    title: "RevOps — overdue follow-up on vendor data feed",
    summary: "Linked to governance SLA breach.",
    severity: "high",
    status: "in_progress",
    domainKey: "revenue",
    sourceType: "change",
    sourceRef: changeChiliId,
    ownerUserId: sarahId,
    ownerTeamKey: "revops",
    openedDaysAgo: 10,
    createdBy: sarahId,
  });
  await admin.from("change_issue_links").insert({ change_id: changeChiliId, issue_id: revOverdue, link_type: "related" });

  /** Engineering queue — 3 Jira-linked issues */
  for (let i = 0; i < 3; i++) {
    const id = await insertIssue(admin, {
      orgId,
      key: `BP-ENG-${i}`,
      title: `Engineering remediation ${i + 1} (Jira linked)`,
      summary: "Hotfix / verification workstream.",
      severity: "high",
      status: i === 0 ? "in_progress" : "assigned",
      domainKey: "revenue",
      sourceType: "manual",
      sourceRef: `demo:eng:${i}`,
      ownerUserId: priyaId,
      ownerTeamKey: "engineering",
      openedDaysAgo: 3,
      createdBy: marcusId,
    });
    await admin.from("issue_jira_links").insert({
      org_id: orgId,
      issue_id: id,
      jira_issue_key: `ENG-${3100 + i}`,
      jira_issue_id: String(3100 + i),
      jira_project_key: "ENG",
    });
  }

  /** Finance queue */
  const financeTitles = ["Stripe renewals gap", "NetSuite AR sync", "Pricing ladder defect"];
  for (let i = 0; i < financeTitles.length; i++) {
    const t = financeTitles[i]!;
    await insertIssue(admin, {
      orgId,
      key: `BP-FIN-${i + 1}`,
      title: t,
      summary: t,
      severity: "high",
      status: "assigned",
      domainKey: "revenue",
      sourceType: "manual",
      sourceRef: `demo:finance:${t}`,
      ownerUserId: danielId,
      ownerTeamKey: "billing",
      openedDaysAgo: 4,
      createdBy: danielId,
    });
  }

  /** execution_tasks (18) */
  const taskIssues = [issueChili, issueDup, issueStripe, issuePricing, ...resolvedIds, ...revopsAssigned, revOverdue];
  let taskCount = 0;
  while (taskCount < 18) {
    const issueId = taskIssues[taskCount % taskIssues.length]!;
    const { error } = await admin.from("execution_tasks").insert({
      issue_id: issueId,
      external_system: taskCount % 3 === 0 ? "jira" : taskCount % 3 === 1 ? "slack" : "hubspot",
      external_task_id: `DEMO-TASK-${taskCount}`,
      task_type: "remediation",
      status: taskCount % 5 === 0 ? "open" : "in_progress",
      assignee_ref: email("sarah.chen"),
      due_at: daysAgo(-(taskCount % 7)),
      sync_status: "synced",
    });
    if (error) throw error;
    taskCount += 1;
  }

  /** issue_comments (~35) */
  const commentBodies = [
    "We think this started after the April 4 routing update.",
    "Can we confirm whether this impacts enterprise only or all inbound leads?",
    "Engineering has a fix ready pending approval.",
    "Finance needs the corrected AR aging before EOW.",
    "Zendesk volumes are elevated but secondary to routing.",
    "Snowflake job reran clean after manual kick.",
    "NetSuite sync delay correlates with API throttle window.",
  ];
  const allIssueIds = [
    issueChili,
    issueDup,
    issueStripe,
    issuePricing,
    ...secondaryIds,
    ...resolvedIds,
    ...revopsAssigned,
    revOverdue,
  ];
  let c = 0;
  const authors = [sarahId, marcusId, priyaId, danielId, rachelId];
  while (c < 35) {
    const issueId = allIssueIds[c % allIssueIds.length]!;
    const { error } = await admin.from("issue_comments").insert({
      issue_id: issueId,
      author_user_id: authors[c % authors.length]!,
      body: `${commentBodies[c % commentBodies.length]} (#${c + 1})`,
      visibility: "internal",
      created_at: daysAgo(1 + (c % 9)),
    });
    if (error) throw error;
    c += 1;
  }

  for (const rid of resolvedIds) {
    await admin.from("issue_comments").insert({
      issue_id: rid,
      author_user_id: sarahId,
      body: "Verification complete — before/after bookings metric back to baseline; finance signed off.",
      visibility: "internal",
      created_at: daysAgo(2),
    });
  }

  /** notification_outbox — 25 Slack rows */
  for (let i = 0; i < 25; i++) {
    const st = i % 7 === 0 ? "FAILED" : i % 5 === 0 ? "SENT" : "DELIVERED";
    const delivered = st === "DELIVERED" ? daysAgo(1) : null;
    const sent = st === "SENT" || st === "DELIVERED" ? daysAgo(1) : null;
    await admin.from("notification_outbox").insert({
      org_id: orgId,
      change_event_id: i % 2 === 0 ? changeChiliId : changePricingId,
      channel: "SLACK",
      template_key: "ops_alert",
      payload: { demo: true, idx: i },
      status: st,
      attempt_count: st === "FAILED" ? 3 : 1,
      sent_at: sent,
      delivered_at: delivered,
      available_at: daysAgo(2),
    });
  }

  /** metric_snapshots — 90d trend */
  for (let d = 0; d < 90; d++) {
    const day = new Date();
    day.setUTCDate(day.getUTCDate() - d);
    day.setUTCHours(12, 0, 0, 0);
    const ramp = 800_000 + (90 - d) * 4000 + (d % 11) * 12_000;
    await admin.from("metric_snapshots").insert({
      organization_id: orgId,
      metric_name: "revenue_at_risk_trend",
      metric_value: ramp,
      snapshot_time: day.toISOString(),
    });
  }

  /** Saved views (queue filters) */
  await admin.from("user_saved_views").insert([
    {
      user_id: demoAdminId,
      name: "BluePeak — RevOps queue",
      query: { owner_team_key: "revops", statuses: ["open", "triaged", "assigned", "in_progress"] },
      is_default: false,
    },
    {
      user_id: demoAdminId,
      name: "BluePeak — Engineering queue",
      query: { owner_team_key: "engineering" },
      is_default: false,
    },
    {
      user_id: demoAdminId,
      name: "BluePeak — Finance queue",
      query: { owner_team_key: "billing" },
      is_default: false,
    },
  ]);

  console.log("");
  console.log("Done.");
  console.log(`  Org: ${ORG_NAME}`);
  console.log(`  Slug: ${DEMO_SLUG}`);
  console.log(`  Log in (shared password): ${PASSWORD}`);
  console.log(`  Primary owner: ${email("olivia.martinez")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

async function insertIssue(
  admin: SupabaseClient,
  args: {
    orgId: string;
    key: string;
    title: string;
    summary: string;
    severity: "low" | "medium" | "high" | "critical";
    status: "open" | "triaged" | "assigned" | "in_progress" | "resolved" | "verified" | "dismissed";
    domainKey: string;
    sourceType: string;
    sourceRef: string;
    ownerUserId: string | null;
    ownerTeamKey: string | null;
    openedDaysAgo: number;
    createdBy: string | null;
    resolvedDaysAgo?: number;
    verifiedDaysAgo?: number;
  }
): Promise<string> {
  const opened = daysAgo(args.openedDaysAgo);
  const resolved =
    args.resolvedDaysAgo != null ? daysAgo(args.resolvedDaysAgo) : args.status === "resolved" || args.status === "verified" ? daysAgo(2) : null;
  const verified = args.verifiedDaysAgo != null ? daysAgo(args.verifiedDaysAgo) : args.status === "verified" ? daysAgo(1) : null;

  const { data, error } = await admin
    .from("issues")
    .insert({
      org_id: args.orgId,
      issue_key: args.key,
      source_type: args.sourceType,
      source_ref: args.sourceRef,
      source_event_time: opened,
      domain_key: args.domainKey,
      title: args.title,
      description: args.summary,
      summary: args.summary,
      severity: args.severity,
      status: args.status,
      verification_status:
        args.status === "verified" ? "passed" : args.status === "resolved" ? "passed" : "pending",
      priority_score: args.severity === "critical" ? 95 : 70,
      impact_score: args.severity === "critical" ? 90 : 60,
      confidence_score: 0.88,
      owner_user_id: args.ownerUserId,
      owner_team_key: args.ownerTeamKey,
      opened_at: opened,
      triaged_at: args.status !== "open" ? daysAgo(args.openedDaysAgo - 1) : null,
      assigned_at: ["assigned", "in_progress", "resolved", "verified"].includes(args.status) ? daysAgo(args.openedDaysAgo - 1) : null,
      in_progress_at: args.status === "in_progress" ? daysAgo(args.openedDaysAgo - 1) : null,
      resolved_at: resolved,
      verified_at: verified,
      created_by: args.createdBy,
      updated_at: daysAgo(0),
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("issue insert");
  return (data as { id: string }).id;
}

async function upsertIssueImpactFromDemo(
  admin: SupabaseClient,
  args: {
    orgId: string;
    modelId: string;
    modelKey: string;
    modelVersion: string;
    issueId: string;
    revenueAtRisk: number;
    loss: number;
  }
) {
  const { data: q, error: qe } = await admin
    .from("impact_quantifications")
    .insert({
      org_id: args.orgId,
      issue_id: args.issueId,
      finding_id: null,
      impact_model_id: args.modelId,
      model_key: args.modelKey,
      model_version: args.modelVersion,
      assessment_status: "estimated",
      direct_realized_loss_amount: args.loss,
      revenue_at_risk_amount: args.revenueAtRisk,
      avoided_loss_amount: 0,
      recovered_value_amount: 0,
      operational_cost_amount: 0,
      affected_customer_count: 50,
      affected_record_count: 200,
      confidence_score: 0.86,
      impact_score: 82,
      inputs_snapshot_json: {},
      assumptions_snapshot_json: {},
      calculation_breakdown_json: {},
      confidence_explanation_json: {},
    })
    .select("id")
    .single();
  if (qe || !q) throw qe ?? new Error("quant insert");

  await admin.from("issue_impact_summaries").upsert(
    {
      issue_id: args.issueId,
      org_id: args.orgId,
      latest_assessment_id: (q as { id: string }).id,
      current_direct_realized_loss_amount: args.loss,
      current_revenue_at_risk_amount: args.revenueAtRisk,
      current_avoided_loss_amount: 0,
      current_recovered_value_amount: 0,
      current_operational_cost_amount: 0,
      current_confidence_score: 0.86,
      current_impact_score: 82,
      last_calculated_at: new Date().toISOString(),
      last_model_key: args.modelKey,
      last_model_version: args.modelVersion,
    },
    { onConflict: "issue_id" }
  );
}
