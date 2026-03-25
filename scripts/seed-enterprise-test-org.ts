#!/usr/bin/env npx tsx
/**
 * Enterprise Test Lab — large org for production-style exercise testing.
 *
 * Creates a dedicated organization with many members, approval roles, sandbox
 * integration accounts (all Phase 1 + Phase 3 providers), governance mappings,
 * sample changes, evidence, approvals, risk events, and revenue policies.
 *
 * Usage (production or staging — uses service role):
 *   npx tsx scripts/seed-enterprise-test-org.ts
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from .env.local or env)
 *   ENTERPRISE_TEST_SEED_PASSWORD — optional; default: Enterprise-Test-Lab-Solvren!2025
 *   ENTERPRISE_TEST_EMAIL_DOMAIN — optional; default: enterprise-test.solvren.test
 *     Use a domain you control (or +aliases) so invites/login work in prod.
 *
 * Idempotent: safe to re-run; upserts org by name, users by email, merges memberships.
 */

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import {
  getRegistryManifest,
  INTEGRATION_PROVIDERS_PHASE1,
  INTEGRATION_PROVIDERS_PHASE3,
} from "../src/modules/integrations/registry/providerRegistry";
import { enableDomainForOrg } from "../src/services/domains/enableDomainForOrg";
import { initializeOnboarding } from "../src/modules/onboarding/services/onboarding-engine.service";
import type { IntegrationProvider } from "../src/modules/integrations/contracts/types";

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
const SEED_PASSWORD = process.env.ENTERPRISE_TEST_SEED_PASSWORD ?? "Enterprise-Test-Lab-Solvren!2025";
const EMAIL_DOMAIN = process.env.ENTERPRISE_TEST_EMAIL_DOMAIN ?? "enterprise-test.solvren.test";

const ORG_NAME = "Solvren Enterprise Test Lab";
const ORG_SLUG = "solvren-enterprise-test-lab";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const email = (local: string) => `${local}@${EMAIL_DOMAIN}`;

type StoredOrgRole = "owner" | "admin" | "reviewer" | "submitter" | "viewer";

type Persona = {
  local: string;
  displayName: string;
  role: StoredOrgRole;
  domainPermissions: { domain: string; canView: boolean; canReview: boolean }[];
  approvalRoles: string[];
};

const APPROVAL_ROLE_NAMES = [
  "Finance Reviewer",
  "Security Reviewer",
  "Billing Owner",
  "Revenue Leadership",
  "Data Reviewer",
  "Legal Reviewer",
  "RevOps Lead",
] as const;

function buildPersonas(): Persona[] {
  const list: Persona[] = [];

  list.push({
    local: "et.owner",
    displayName: "ET Owner",
    role: "owner",
    domainPermissions: [],
    approvalRoles: [],
  });

  for (let i = 1; i <= 3; i++) {
    list.push({
      local: `et.admin.${i}`,
      displayName: `ET Admin ${i}`,
      role: "admin",
      domainPermissions: [
        { domain: "REVENUE", canView: true, canReview: true },
        { domain: "SECURITY", canView: true, canReview: false },
      ],
      approvalRoles: i === 1 ? ["Billing Owner"] : i === 2 ? ["RevOps Lead"] : [],
    });
  }

  for (let i = 1; i <= 8; i++) {
    list.push({
      local: `et.submitter.${i}`,
      displayName: `ET Submitter ${i}`,
      role: "submitter",
      domainPermissions: [{ domain: "REVENUE", canView: true, canReview: false }],
      approvalRoles: [],
    });
  }

  for (let i = 1; i <= 12; i++) {
    list.push({
      local: `et.viewer.${i}`,
      displayName: `ET Viewer ${i}`,
      role: "viewer",
      domainPermissions: [{ domain: "REVENUE", canView: true, canReview: false }],
      approvalRoles: [],
    });
  }

  const reviewerApproval: string[][] = [
    ["Data Reviewer"],
    ["Data Reviewer"],
    ["Data Reviewer", "RevOps Lead"],
    ["Finance Reviewer"],
    ["Finance Reviewer"],
    ["Finance Reviewer", "Revenue Leadership"],
    ["Security Reviewer"],
    ["Security Reviewer"],
    ["Revenue Leadership"],
    ["Revenue Leadership"],
    ["Legal Reviewer"],
    ["Data Reviewer", "Finance Reviewer"],
  ];

  for (let i = 0; i < 12; i++) {
    list.push({
      local: `et.reviewer.${i + 1}`,
      displayName: `ET Reviewer ${i + 1}`,
      role: "reviewer",
      domainPermissions: [
        { domain: "REVENUE", canView: true, canReview: true },
        { domain: "SECURITY", canView: true, canReview: i >= 6 && i <= 8 },
      ],
      approvalRoles: reviewerApproval[i] ?? ["Data Reviewer"],
    });
  }

  list.push({
    local: "et.restricted",
    displayName: "ET Restricted Reviewer",
    role: "reviewer",
    domainPermissions: [{ domain: "REVENUE", canView: true, canReview: false }],
    approvalRoles: [],
  });

  return list;
}

const PERSONAS = buildPersonas();

// Stable UUIDs (enterprise lab namespace — distinct from UAT 1111…)
const CHANGE_IDS = {
  P1: "22222222-2222-5000-8000-000000000001",
  P2: "22222222-2222-5000-8000-000000000002",
  P3: "22222222-2222-5000-8000-000000000003",
  P4: "22222222-2222-5000-8000-000000000004",
  P5: "22222222-2222-5000-8000-000000000005",
  P6: "22222222-2222-5000-8000-000000000006",
  P7: "22222222-2222-5000-8000-000000000007",
  P8: "22222222-2222-5000-8000-000000000008",
  P9: "22222222-2222-5000-8000-000000000009",
  P10: "22222222-2222-5000-8000-000000000010",
  P11: "22222222-2222-5000-8000-000000000011",
  P12: "22222222-2222-5000-8000-000000000012",
  RESTRICTED: "22222222-2222-5000-8000-000000000099",
} as const;

const SEED_REF = new Date("2025-06-01T12:00:00Z").getTime();
const ts = (daysOffset: number) => new Date(SEED_REF + daysOffset * 24 * 60 * 60 * 1000).toISOString();

async function ensureUsers(
  supabase: SupabaseClient,
  personas: Persona[]
): Promise<Record<string, string>> {
  const userIds: Record<string, string> = {};
  const { data: firstPage } = await supabase.auth.admin.listUsers({ perPage: 1000, page: 1 });
  const byEmail = new Map<string, string>();
  for (const u of firstPage?.users ?? []) {
    if (u.email) byEmail.set(u.email.toLowerCase(), u.id);
  }

  for (const p of personas) {
    const addr = email(p.local);
    const found = byEmail.get(addr.toLowerCase());
    if (found) {
      userIds[addr] = found;
      await supabase.auth.admin.updateUserById(found, {
        password: SEED_PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: p.displayName },
      });
      console.log(`  User exists: ${p.displayName} <${addr}>`);
    } else {
      const { data: created, error } = await supabase.auth.admin.createUser({
        email: addr,
        password: SEED_PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: p.displayName },
      });
      if (error) throw error;
      userIds[addr] = created.user.id;
      byEmail.set(addr.toLowerCase(), created.user.id);
      console.log(`  Created user: ${p.displayName} <${addr}>`);
    }
  }
  return userIds;
}

async function upsertIntegrationAccounts(
  supabase: SupabaseClient,
  orgId: string,
  installedByUserId: string
) {
  const providers = [...INTEGRATION_PROVIDERS_PHASE1, ...INTEGRATION_PROVIDERS_PHASE3] as string[];
  const now = new Date().toISOString();

  for (const provider of providers) {
    const m = getRegistryManifest(provider as IntegrationProvider);
    const row = {
      org_id: orgId,
      provider,
      display_name: m.displayName,
      category: m.category,
      auth_type: m.authType,
      status: "connected" as const,
      connection_mode: "manual",
      installed_by_user_id: installedByUserId,
      installed_at: now,
      disconnected_at: null as string | null,
      last_success_at: now,
      last_error_at: null as string | null,
      last_error_code: null as string | null,
      last_error_message: null as string | null,
      health_summary_json: { overall: "healthy", seed: "enterprise-test-lab" },
      scopes_granted_json: [] as string[],
      scopes_missing_json: [] as string[],
      config_json: { sandbox: true, seeded: true },
      secrets_ref: null as string | null,
      metadata_json: { enterprise_test_lab: true },
    };

    const { error } = await supabase.from("integration_accounts").upsert(row, {
      onConflict: "org_id,provider",
    });
    if (error) console.warn(`  integration_accounts ${provider}:`, error.message);
  }
  console.log(`  Integration accounts: ${providers.length} providers (sandbox metadata, no secrets)`);
}

async function main() {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE!, {
    auth: { persistSession: false },
  });

  console.log("Enterprise Test Lab seed");
  console.log("==========================");
  console.log(`  Org name: ${ORG_NAME}`);
  console.log(`  Email domain: ${EMAIL_DOMAIN}`);
  console.log(`  Personas: ${PERSONAS.length}`);

  const userIds = await ensureUsers(supabase, PERSONAS);
  const ownerAddr = email("et.owner");
  const ownerId = userIds[ownerAddr];
  const submitter1 = userIds[email("et.submitter.1")];
  const reviewer4 = userIds[email("et.reviewer.4")];
  const restrictedAddr = email("et.restricted");
  const restrictedId = userIds[restrictedAddr];

  const { data: orgs } = await supabase.from("organizations").select("id").eq("name", ORG_NAME).limit(1);

  let orgId: string;
  if (orgs?.length) {
    orgId = orgs[0].id;
    console.log(`  Org exists: ${ORG_NAME} (${orgId})`);
  } else {
    const { data: org, error } = await supabase
      .from("organizations")
      .insert({
        name: ORG_NAME,
        slug: ORG_SLUG,
        created_by: ownerId,
        industry: "Software",
        company_size: "1000_plus",
        primary_domain: EMAIL_DOMAIN,
      })
      .select("id")
      .single();
    if (error) throw error;
    orgId = org!.id;
    console.log(`  Created org: ${ORG_NAME} (${orgId})`);
  }

  for (const p of PERSONAS) {
    const addr = email(p.local);
    const uid = userIds[addr];
    const { error } = await supabase
      .from("organization_members")
      .upsert({ org_id: orgId, user_id: uid, role: p.role }, { onConflict: "org_id,user_id" });
    if (error) console.warn(`  member ${addr}:`, error.message);
  }
  console.log("  Members synced");

  await supabase.from("organization_settings").upsert(
    {
      org_id: orgId,
      email_enabled: true,
      slack_enabled: false,
      notification_emails: [`ops-lab@${EMAIL_DOMAIN}`, `governance@${EMAIL_DOMAIN}`],
    },
    { onConflict: "org_id" }
  );

  await initializeOnboarding(supabase, orgId);

  await enableDomainForOrg(supabase, { orgId, domainKey: "REVENUE" });
  try {
    await enableDomainForOrg(supabase, { orgId, domainKey: "SECURITY" });
  } catch {
    /* optional domain */
  }

  const roleIds: Record<string, string> = {};
  for (const name of APPROVAL_ROLE_NAMES) {
    const { data: existing } = await supabase
      .from("approval_roles")
      .select("id")
      .eq("org_id", orgId)
      .ilike("role_name", name)
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      roleIds[name] = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from("approval_roles")
        .insert({ org_id: orgId, role_name: name, enabled: true })
        .select("id")
        .single();
      if (error) {
        console.warn(`  approval_roles ${name}:`, error.message);
        continue;
      }
      roleIds[name] = created!.id;
    }
  }

  for (const p of PERSONAS) {
    const uid = userIds[email(p.local)];
    for (const ar of p.approvalRoles) {
      const rid = roleIds[ar];
      if (!rid) continue;
      await supabase.from("approval_role_members").upsert(
        { org_id: orgId, role_id: rid, user_id: uid },
        { onConflict: "role_id,user_id" }
      );
    }
  }
  console.log("  Approval roles + members synced");

  const mappingRows: { trigger_type: string; trigger_value: string; role: string; priority: number }[] = [
    { trigger_type: "DOMAIN", trigger_value: "REVENUE", role: "Finance Reviewer", priority: 100 },
    { trigger_type: "DOMAIN", trigger_value: "REVENUE", role: "Data Reviewer", priority: 90 },
    { trigger_type: "DOMAIN", trigger_value: "SECURITY", role: "Security Reviewer", priority: 100 },
    { trigger_type: "SYSTEM", trigger_value: "Stripe", role: "Billing Owner", priority: 100 },
    { trigger_type: "SYSTEM", trigger_value: "Salesforce", role: "RevOps Lead", priority: 100 },
    { trigger_type: "SYSTEM", trigger_value: "HubSpot", role: "RevOps Lead", priority: 95 },
    { trigger_type: "SYSTEM", trigger_value: "NetSuite", role: "Finance Reviewer", priority: 95 },
    { trigger_type: "CHANGE_TYPE", trigger_value: "PRICING", role: "Revenue Leadership", priority: 100 },
    { trigger_type: "CHANGE_TYPE", trigger_value: "BILLING", role: "Billing Owner", priority: 100 },
    { trigger_type: "CHANGE_TYPE", trigger_value: "CONTRACT", role: "Legal Reviewer", priority: 100 },
    { trigger_type: "CHANGE_TYPE", trigger_value: "CRM_SCHEMA", role: "RevOps Lead", priority: 90 },
  ];

  for (const m of mappingRows) {
    const rid = roleIds[m.role];
    if (!rid) continue;
    const { error } = await supabase.from("approval_mappings").insert({
      org_id: orgId,
      trigger_type: m.trigger_type,
      trigger_value: m.trigger_value,
      approval_role_id: rid,
      priority: m.priority,
      enabled: true,
    });
    if (error?.code === "23505") {
      /* already exists */
    } else if (error) {
      console.warn(`  mapping ${m.trigger_type}=${m.trigger_value}:`, error.message);
    }
  }

  for (const p of PERSONAS) {
    const uid = userIds[email(p.local)];
    for (const perm of p.domainPermissions) {
      const domain =
        perm.domain === "FINANCE"
          ? "REVENUE"
          : ["REVENUE", "DATA", "WORKFLOW", "SECURITY"].includes(perm.domain)
            ? perm.domain
            : null;
      if (!domain) continue;
      await supabase.from("user_domain_permissions").upsert(
        {
          org_id: orgId,
          user_id: uid,
          domain,
          can_view: perm.canView,
          can_review: perm.canReview,
        },
        { onConflict: "org_id,user_id,domain" }
      );
    }
  }

  const { data: bs } = await supabase
    .from("org_bootstrap_status")
    .select("revenueguard_seeded")
    .eq("org_id", orgId)
    .maybeSingle();

  if (!bs?.revenueguard_seeded) {
    const approvalSeed = [
      { org_id: orgId, domain: "REVENUE", risk_bucket: "LOW", required_role: "DOMAIN_REVIEWER", min_count: 1 },
      { org_id: orgId, domain: "REVENUE", risk_bucket: "MEDIUM", required_role: "DOMAIN_REVIEWER", min_count: 1 },
      { org_id: orgId, domain: "REVENUE", risk_bucket: "HIGH", required_role: "DOMAIN_REVIEWER", min_count: 1 },
      { org_id: orgId, domain: "REVENUE", risk_bucket: "HIGH", required_role: "RISK_OWNER", min_count: 1 },
      { org_id: orgId, domain: "REVENUE", risk_bucket: "CRITICAL", required_role: "DOMAIN_REVIEWER", min_count: 1 },
      { org_id: orgId, domain: "REVENUE", risk_bucket: "CRITICAL", required_role: "RISK_OWNER", min_count: 1 },
    ];
    for (const row of approvalSeed) {
      await supabase.from("approval_requirements").upsert(row, {
        onConflict: "org_id,domain,risk_bucket,required_role",
      });
    }
    await supabase.from("org_bootstrap_status").upsert(
      { org_id: orgId, revenueguard_seeded: true, seeded_at: new Date().toISOString() },
      { onConflict: "org_id" }
    );
  }

  await upsertIntegrationAccounts(supabase, orgId, ownerId);

  const changes: Array<{
    id: string;
    title: string;
    change_type: string;
    status: string;
    domain: string;
    systems_involved: string[];
    backfill_required: boolean;
    rollout_method?: string | null;
    revenue_surface?: string | null;
    submitted_at?: string | null;
    due_at?: string | null;
    sla_status?: string;
    is_restricted: boolean;
    created_by: string;
    created_at: string;
    updated_at: string;
    ready_at?: string | null;
  }> = [
    {
      id: CHANGE_IDS.P1,
      title: "[Lab] Global price book realignment",
      change_type: "PRICING",
      status: "IN_REVIEW",
      domain: "REVENUE",
      systems_involved: ["Stripe", "Salesforce", "NetSuite"],
      backfill_required: true,
      rollout_method: "PHASED",
      revenue_surface: "PRICING",
      submitted_at: ts(-5),
      due_at: ts(3),
      sla_status: "ON_TRACK",
      is_restricted: false,
      created_by: submitter1,
      created_at: ts(-10),
      updated_at: ts(-4),
      ready_at: ts(-5),
    },
    {
      id: CHANGE_IDS.P2,
      title: "[Lab] Billing dunning workflow change",
      change_type: "BILLING",
      status: "IN_REVIEW",
      domain: "REVENUE",
      systems_involved: ["Stripe", "Chargebee"],
      backfill_required: false,
      revenue_surface: "BILLING",
      submitted_at: ts(-3),
      due_at: ts(-1),
      sla_status: "OVERDUE",
      is_restricted: false,
      created_by: submitter1,
      created_at: ts(-8),
      updated_at: ts(-2),
      ready_at: ts(-3),
    },
    {
      id: CHANGE_IDS.P3,
      title: "[Lab] Multi-currency contract templates",
      change_type: "CONTRACT",
      status: "DRAFT",
      domain: "REVENUE",
      systems_involved: ["Salesforce", "NetSuite"],
      backfill_required: false,
      is_restricted: false,
      created_by: submitter1,
      created_at: ts(-2),
      updated_at: ts(0),
    },
    {
      id: CHANGE_IDS.P4,
      title: "[Lab] Marketing attribution model v3",
      change_type: "MARKETING_AUTOMATION",
      status: "IN_REVIEW",
      domain: "REVENUE",
      systems_involved: ["HubSpot", "Snowflake"],
      backfill_required: true,
      submitted_at: ts(-4),
      due_at: ts(5),
      sla_status: "ON_TRACK",
      is_restricted: false,
      created_by: submitter1,
      created_at: ts(-9),
      updated_at: ts(-3),
      ready_at: ts(-4),
    },
    {
      id: CHANGE_IDS.P5,
      title: "[Lab] CPQ field dependency overhaul",
      change_type: "CRM_SCHEMA",
      status: "DRAFT",
      domain: "REVENUE",
      systems_involved: ["Salesforce", "HubSpot"],
      backfill_required: false,
      is_restricted: false,
      created_by: submitter1,
      created_at: ts(-1),
      updated_at: ts(0),
    },
    {
      id: CHANGE_IDS.P6,
      title: "[Lab] Revenue subledger → warehouse sync",
      change_type: "REVENUE_INTEGRATION",
      status: "APPROVED",
      domain: "REVENUE",
      systems_involved: ["NetSuite", "BigQuery", "Snowflake"],
      backfill_required: true,
      submitted_at: ts(-20),
      due_at: ts(-15),
      sla_status: "ON_TRACK",
      is_restricted: false,
      created_by: submitter1,
      created_at: ts(-22),
      updated_at: ts(-14),
      ready_at: null,
    },
    {
      id: CHANGE_IDS.P7,
      title: "[Lab] SOC2 evidence export automation",
      change_type: "OTHER",
      status: "IN_REVIEW",
      domain: "SECURITY",
      systems_involved: ["Jira", "GitHub"],
      backfill_required: false,
      is_restricted: true,
      submitted_at: ts(-6),
      due_at: ts(2),
      sla_status: "ON_TRACK",
      created_by: submitter1,
      created_at: ts(-8),
      updated_at: ts(-5),
      ready_at: ts(-6),
    },
    {
      id: CHANGE_IDS.P8,
      title: "[Lab] Usage metering API rollout",
      change_type: "BILLING",
      status: "REJECTED",
      domain: "REVENUE",
      systems_involved: ["Stripe"],
      backfill_required: false,
      submitted_at: ts(-12),
      due_at: ts(-8),
      sla_status: "ON_TRACK",
      is_restricted: false,
      created_by: submitter1,
      created_at: ts(-14),
      updated_at: ts(-7),
      ready_at: ts(-12),
    },
    {
      id: CHANGE_IDS.P9,
      title: "[Lab] Partner portal discount matrix",
      change_type: "PRICING",
      status: "DRAFT",
      domain: "REVENUE",
      systems_involved: ["Salesforce", "Stripe"],
      backfill_required: false,
      is_restricted: false,
      created_by: submitter1,
      created_at: ts(-3),
      updated_at: ts(0),
    },
    {
      id: CHANGE_IDS.P10,
      title: "[Lab] ETL: Postgres RO replica for analytics",
      change_type: "REVENUE_INTEGRATION",
      status: "IN_REVIEW",
      domain: "REVENUE",
      systems_involved: ["postgres_readonly", "BigQuery"],
      backfill_required: true,
      submitted_at: ts(-2),
      due_at: ts(7),
      sla_status: "ON_TRACK",
      is_restricted: false,
      created_by: submitter1,
      created_at: ts(-5),
      updated_at: ts(-1),
      ready_at: ts(-2),
    },
    {
      id: CHANGE_IDS.P11,
      title: "[Lab] Slack deal-desk notifications",
      change_type: "OTHER",
      status: "DRAFT",
      domain: "REVENUE",
      systems_involved: ["Slack", "Salesforce"],
      backfill_required: false,
      is_restricted: false,
      created_by: submitter1,
      created_at: ts(0),
      updated_at: ts(0),
    },
    {
      id: CHANGE_IDS.P12,
      title: "[Lab] MySQL billing mirror read path",
      change_type: "REVENUE_INTEGRATION",
      status: "IN_REVIEW",
      domain: "REVENUE",
      systems_involved: ["mysql_readonly", "Stripe"],
      backfill_required: false,
      submitted_at: ts(-1),
      due_at: ts(4),
      sla_status: "ON_TRACK",
      is_restricted: false,
      created_by: submitter1,
      created_at: ts(-4),
      updated_at: ts(-1),
      ready_at: ts(-1),
    },
    {
      id: CHANGE_IDS.RESTRICTED,
      title: "[Lab] Restricted — executive compensation reporting",
      change_type: "OTHER",
      status: "IN_REVIEW",
      domain: "SECURITY",
      systems_involved: ["Snowflake", "BigQuery"],
      backfill_required: false,
      is_restricted: true,
      submitted_at: ts(-3),
      due_at: ts(1),
      sla_status: "ON_TRACK",
      created_by: submitter1,
      created_at: ts(-5),
      updated_at: ts(-2),
      ready_at: ts(-3),
    },
  ];

  for (const c of changes) {
    const { error } = await supabase.from("change_events").upsert(
      {
        id: c.id,
        org_id: orgId,
        title: c.title,
        change_type: c.change_type,
        status: c.status,
        domain: c.domain,
        systems_involved: c.systems_involved,
        backfill_required: c.backfill_required,
        intake: {},
        rollout_method: c.rollout_method ?? null,
        revenue_surface: c.revenue_surface ?? null,
        submitted_at: c.submitted_at ?? null,
        due_at: c.due_at ?? null,
        sla_status: c.sla_status ?? "ON_TRACK",
        is_restricted: c.is_restricted,
        created_by: c.created_by,
        created_at: c.created_at,
        updated_at: c.updated_at,
        ready_at: c.ready_at ?? null,
      },
      { onConflict: "id" }
    );
    if (error) console.warn(`  change ${c.title}:`, error.message);
  }

  const changeIdList = Object.values(CHANGE_IDS);
  await supabase.from("change_evidence_items").delete().in("change_event_id", changeIdList);
  const evidenceRows: Array<{
    change_event_id: string;
    kind: string;
    label: string;
    status: "PROVIDED" | "MISSING";
    severity: "REQUIRED" | "OPTIONAL";
  }> = [
    { change_event_id: CHANGE_IDS.P1, kind: "ROLLBACK_PLAN", label: "Rollback plan", status: "PROVIDED", severity: "REQUIRED" },
    { change_event_id: CHANGE_IDS.P1, kind: "TEST_PLAN", label: "Test plan", status: "PROVIDED", severity: "REQUIRED" },
    { change_event_id: CHANGE_IDS.P2, kind: "ROLLBACK_PLAN", label: "Rollback plan", status: "MISSING", severity: "REQUIRED" },
    { change_event_id: CHANGE_IDS.P2, kind: "TEST_PLAN", label: "Test plan", status: "MISSING", severity: "REQUIRED" },
    { change_event_id: CHANGE_IDS.P4, kind: "ROLLBACK_PLAN", label: "Rollback plan", status: "PROVIDED", severity: "REQUIRED" },
    { change_event_id: CHANGE_IDS.P6, kind: "TEST_PLAN", label: "Test plan", status: "PROVIDED", severity: "REQUIRED" },
  ];
  for (const row of evidenceRows) {
    await supabase.from("change_evidence_items").insert({
      change_event_id: row.change_event_id,
      org_id: orgId,
      kind: row.kind,
      label: row.label,
      status: row.status,
      severity: row.severity,
    });
  }

  await supabase.from("approvals").delete().in("change_event_id", changeIdList);
  await supabase.from("approvals").insert([
    {
      change_event_id: CHANGE_IDS.P2,
      org_id: orgId,
      approver_user_id: reviewer4,
      approval_area: "Finance Reviewer",
      domain: "REVENUE",
      decision: "PENDING",
    },
    {
      change_event_id: CHANGE_IDS.P6,
      org_id: orgId,
      approver_user_id: reviewer4,
      approval_area: "Finance Reviewer",
      domain: "REVENUE",
      decision: "APPROVED",
      decided_at: ts(-14),
    },
  ]);

  await supabase.from("change_permissions").upsert(
    {
      org_id: orgId,
      change_event_id: CHANGE_IDS.P7,
      user_id: restrictedId,
      access_type: "VIEW",
    },
    { onConflict: "change_event_id,user_id,access_type", ignoreDuplicates: true }
  );
  await supabase.from("change_permissions").upsert(
    {
      org_id: orgId,
      change_event_id: CHANGE_IDS.RESTRICTED,
      user_id: restrictedId,
      access_type: "VIEW",
    },
    { onConflict: "change_event_id,user_id,access_type", ignoreDuplicates: true }
  );

  await supabase.from("revenue_impact_reports").upsert(
    {
      org_id: orgId,
      change_id: CHANGE_IDS.P1,
      version: 1,
      status: "COMPLETED",
      generated_by: "RULES_ONLY",
      input_hash: "seed-enterprise-lab-v1",
      report_json: {
        summary: "Enterprise lab: broad pricing + CRM surface area.",
        risk_factors: ["modifies_pricing_logic", "affects_active_billing_system"],
      },
      baseline_json: {},
      summary_text: "High coordination load; finance, RevOps, and billing paths implicated.",
      risk_score: 82,
      risk_level: "HIGH",
      is_current: true,
    },
    { onConflict: "change_id,version" }
  );

  await supabase.from("coordination_plans").upsert(
    {
      org_id: orgId,
      change_id: CHANGE_IDS.P1,
      version: 1,
      status: "COMPLETED",
      generated_by: "RULES_ONLY",
      input_hash: "seed-enterprise-lab-v1",
      plan_json: {
        suggested_approvers: [
          { role: "Finance Reviewer", reason: "Domain: REVENUE" },
          { role: "Revenue Leadership", reason: "Change type: PRICING" },
          { role: "Billing Owner", reason: "System: Stripe" },
        ],
      },
      summary_text: "Finance, Revenue Leadership, Billing Owner suggested.",
      is_current: true,
    },
    { onConflict: "change_id,version" }
  );

  await supabase.from("change_timeline_events").delete().in("change_event_id", changeIdList);
  const timelineEvents = [
    {
      org_id: orgId,
      change_event_id: CHANGE_IDS.P1,
      actor_user_id: submitter1,
      event_type: "CHANGE_SUBMITTED",
      title: "Submitted for review",
      description: "Enterprise lab seed",
      created_at: ts(-5),
    },
    {
      org_id: orgId,
      change_event_id: CHANGE_IDS.P6,
      actor_user_id: reviewer4,
      event_type: "APPROVAL_APPROVED",
      title: "Finance Reviewer approved",
      description: "Lab approval",
      created_at: ts(-14),
    },
  ];
  for (const ev of timelineEvents) {
    await supabase.from("change_timeline_events").insert(ev);
  }

  await supabase.from("risk_events").delete().eq("org_id", orgId);
  const riskRows = [
    { provider: "Stripe", object: "Product", object_id: "prod_lab_1", risk_type: "price_update", risk_score: 91, risk_bucket: "HIGH", impact_amount: 890000, change_event_id: CHANGE_IDS.P1, timestamp: ts(-2) },
    { provider: "Salesforce", object: "Opportunity", object_id: "OPP-LAB-9001", risk_type: "discount_change", risk_score: 86, risk_bucket: "HIGH", impact_amount: 210000, change_event_id: null, timestamp: ts(-1) },
    { provider: "HubSpot", object: "Workflow", object_id: "WF-4412", risk_type: "routing_change", risk_score: 62, risk_bucket: "MODERATE", impact_amount: 45000, change_event_id: CHANGE_IDS.P4, timestamp: ts(0) },
    { provider: "NetSuite", object: "CustomRecord", object_id: "CR-88", risk_type: "config_change", risk_score: 71, risk_bucket: "MODERATE", impact_amount: 120000, change_event_id: CHANGE_IDS.P6, timestamp: ts(-4) },
    { provider: "Jira", object: "Issue", object_id: "GOV-1200", risk_type: "policy_exception", risk_score: 55, risk_bucket: "MODERATE", impact_amount: null, change_event_id: CHANGE_IDS.P7, timestamp: ts(-3) },
  ];
  for (const r of riskRows) {
    await supabase.from("risk_events").insert({
      org_id: orgId,
      provider: r.provider,
      object: r.object,
      object_id: r.object_id,
      risk_type: r.risk_type,
      risk_score: r.risk_score,
      risk_bucket: r.risk_bucket,
      impact_amount: r.impact_amount,
      change_event_id: r.change_event_id,
      approved_at: null,
      timestamp: r.timestamp,
      field: null,
      old_value: null,
      new_value: null,
    });
  }

  const { data: existingPolicies } = await supabase.from("revenue_policies").select("id").eq("org_id", orgId).limit(1);
  if (!existingPolicies?.length) {
    const policyRows = [
      { name: "[Lab] Discount guardrail", description: "Discounts over 35% require Finance + RevOps", rule_type: "DISCOUNT_LIMIT", rule_config: { threshold: 35 }, systems_affected: ["Salesforce", "Stripe"], enforcement_mode: "REQUIRE_APPROVAL" as const },
      { name: "[Lab] Pricing change dual control", description: "Pricing changes require two approval roles", rule_type: "PRICING_CHANGE", rule_config: {}, systems_affected: ["Stripe", "NetSuite"], enforcement_mode: "REQUIRE_APPROVAL" as const },
      { name: "[Lab] Block extreme discounts", description: "Hard block above 55%", rule_type: "DISCOUNT_LIMIT", rule_config: { threshold: 55 }, systems_affected: ["Salesforce"], enforcement_mode: "BLOCK" as const },
      { name: "[Lab] Monitor warehouse exports", description: "Log Snowflake/BQ export config changes", rule_type: "BILLING_RULE", rule_config: {}, systems_affected: ["Snowflake", "BigQuery"], enforcement_mode: "MONITOR" as const },
    ];
    for (const p of policyRows) {
      await supabase.from("revenue_policies").insert({
        org_id: orgId,
        name: p.name,
        description: p.description,
        rule_type: p.rule_type,
        rule_config: p.rule_config,
        systems_affected: p.systems_affected,
        enforcement_mode: p.enforcement_mode,
        enabled: true,
        priority: 100,
      });
    }
  }

  console.log("");
  console.log("Done.");
  console.log(`  Log in as owner: ${ownerAddr} / (ENTERPRISE_TEST_SEED_PASSWORD)`);
  console.log(`  Organization: "${ORG_NAME}" — ${PERSONAS.length} users, integrations, changes, policies.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
