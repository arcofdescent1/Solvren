#!/usr/bin/env npx tsx
/**
 * Solara Health — sales demo org (service role).
 *
 * Idempotent: targets org slug `solara-health-demo` + fixed change UUIDs.
 * Clears only Solara-scoped change artifacts (by org_id + known change ids), then reseeds.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (.env.local loaded when present)
 * Optional: SOLARA_DEMO_PASSWORD (default Solara-Demo-2026!)
 *
 * Safety: For non-local Supabase URLs, set ALLOW_DEMO_SEED=true or the script exits.
 *
 * Usage: npx tsx scripts/seed-solara-demo.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { enableDomainForOrg } from "../src/services/domains/enableDomainForOrg";
import { initializeOnboarding } from "../src/modules/onboarding/services/onboarding-engine.service";

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

const DEMO_SLUG = "solara-health-demo";
const ORG_NAME = "Solara Health";
const EMAIL_DOMAIN = "solara-demo.solvren.test";
const DEMO_PASSWORD = process.env.SOLARA_DEMO_PASSWORD ?? "Solara-Demo-2026!";

/** Fixed change UUIDs — only these rows are deleted/reseeded for this org. */
const CHANGE_IDS = {
  STRIPE_PRICING_HERO: "22222222-2222-5000-8000-000000000001",
  BILLING_RECON: "22222222-2222-5000-8000-000000000002",
  REVREC_Q1: "22222222-2222-5000-8000-000000000003",
  HUBSPOT_ROUTING: "22222222-2222-5000-8000-000000000004",
  NS_COA: "22222222-2222-5000-8000-000000000005",
  PROMO_DISCOUNT: "22222222-2222-5000-8000-000000000006",
} as const;

const ALL_CHANGE_IDS = Object.values(CHANGE_IDS);

function email(local: string) {
  return `${local}@${EMAIL_DOMAIN}`.toLowerCase();
}

function isLocalSupabaseUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      u.hostname === "kong" ||
      u.hostname.endsWith(".local")
    );
  } catch {
    return false;
  }
}

function assertDemoSeedAllowed() {
  const url = SUPABASE_URL ?? "";
  if (!url) return;
  if (isLocalSupabaseUrl(url)) return;
  if (process.env.ALLOW_DEMO_SEED !== "true") {
    console.error(
      "Refusing to run against non-local Supabase: set ALLOW_DEMO_SEED=true after confirming the target project."
    );
    process.exit(1);
  }
}

type Persona = {
  local: string;
  displayName: string;
  role: "owner" | "admin" | "reviewer" | "submitter" | "viewer";
  domainPermissions: { domain: string; canView: boolean; canReview: boolean }[];
  approvalRoles: string[];
};

const PERSONAS: Persona[] = [
  {
    local: "ryan.brooks",
    displayName: "Ryan Brooks",
    role: "owner",
    domainPermissions: [],
    approvalRoles: [],
  },
  {
    local: "emma.patel",
    displayName: "Emma Patel",
    role: "admin",
    domainPermissions: [{ domain: "REVENUE", canView: true, canReview: true }],
    approvalRoles: [],
  },
  {
    local: "daniel.kim",
    displayName: "Daniel Kim",
    role: "reviewer",
    domainPermissions: [
      { domain: "REVENUE", canView: true, canReview: true },
      { domain: "FINANCE", canView: true, canReview: true },
    ],
    approvalRoles: ["Finance Reviewer"],
  },
  {
    local: "priya.shah",
    displayName: "Priya Shah",
    role: "reviewer",
    domainPermissions: [{ domain: "REVENUE", canView: true, canReview: true }],
    approvalRoles: ["Billing Owner"],
  },
  {
    local: "alex.morgan",
    displayName: "Alex Morgan",
    role: "reviewer",
    domainPermissions: [{ domain: "REVENUE", canView: true, canReview: true }],
    approvalRoles: ["Data Reviewer"],
  },
  {
    local: "sophie.martinez",
    displayName: "Sophie Martinez",
    role: "submitter",
    domainPermissions: [{ domain: "REVENUE", canView: true, canReview: false }],
    approvalRoles: [],
  },
  {
    local: "maya.chen",
    displayName: "Maya Chen",
    role: "reviewer",
    domainPermissions: [{ domain: "REVENUE", canView: true, canReview: true }],
    approvalRoles: ["Revenue Leadership"],
  },
  {
    local: "jordan.lee",
    displayName: "Jordan Lee",
    role: "reviewer",
    domainPermissions: [{ domain: "REVENUE", canView: true, canReview: true }],
    approvalRoles: [],
  },
];

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
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: p.displayName },
      });
      out[addr] = found;
    } else {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: addr,
        password: DEMO_PASSWORD,
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

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

async function clearSolaraChangeArtifacts(admin: SupabaseClient, orgId: string) {
  // `change_events.id` is globally unique. Stray rows from a prior failed run (any org_id)
  // would block inserts for a freshly created Solara org — remove reserved IDs project-wide.
  const { data: owned } = await admin
    .from("change_events")
    .select("id, org_id")
    .in("id", ALL_CHANGE_IDS);
  const rows = owned ?? [];
  if (rows.length === 0) return;

  const foreignOrg = rows.find((r) => r.org_id !== orgId);
  if (foreignOrg) {
    console.warn(
      `  Warning: Solara-reserved change id(s) existed under another org_id (${String(foreignOrg.org_id)}); deleting globally so seed can proceed.`
    );
  }

  const safeIds = rows.map((r) => r.id as string);

  await admin.from("risk_events").delete().in("change_event_id", safeIds);
  await admin.from("change_timeline_events").delete().in("change_event_id", safeIds);
  await admin.from("change_permissions").delete().in("change_event_id", safeIds);
  await admin.from("revenue_impact_reports").delete().in("change_id", safeIds);
  await admin.from("coordination_plans").delete().in("change_id", safeIds);
  await admin.from("risk_assessment_outputs").delete().in("change_event_id", safeIds);
  await admin.from("impact_assessments").delete().in("change_event_id", safeIds);
  await admin.from("risk_signals").delete().in("change_event_id", safeIds);
  await admin.from("change_evidence").delete().in("change_event_id", safeIds);
  await admin.from("change_evidence_items").delete().in("change_event_id", safeIds);
  await admin.from("approvals").delete().in("change_event_id", safeIds);
  const { error } = await admin.from("change_events").delete().in("id", safeIds);
  if (error) throw error;
}

async function main() {
  assertDemoSeedAllowed();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("Solara Health demo seed");
  console.log("=======================");

  const userIds = await ensureUsers(admin);
  const ryanId = userIds[email("ryan.brooks")];
  const emmaId = userIds[email("emma.patel")];
  const danielId = userIds[email("daniel.kim")];
  const priyaId = userIds[email("priya.shah")];
  const alexId = userIds[email("alex.morgan")];
  const sophieId = userIds[email("sophie.martinez")];
  const mayaId = userIds[email("maya.chen")];
  const jordanId = userIds[email("jordan.lee")];

  const { data: existingOrg, error: findErr } = await admin
    .from("organizations")
    .select("id, is_demo, slug")
    .eq("slug", DEMO_SLUG)
    .maybeSingle();
  if (findErr) throw findErr;

  let orgId: string;

  if (existingOrg?.id) {
    if (!existingOrg.is_demo) {
      console.error(
        `Organization slug ${DEMO_SLUG} exists but is_demo is false. Refusing to modify. Set is_demo=true manually if appropriate.`
      );
      process.exit(1);
    }
    orgId = existingOrg.id as string;
    const { error: updErr } = await admin
      .from("organizations")
      .update({
        name: ORG_NAME,
        website: "https://solarahealth.example",
        primary_domain: "solarahealth.example",
        industry: "B2B Healthcare SaaS",
        company_size: "51-200",
        is_demo: true,
        demo_slug: DEMO_SLUG,
        demo_profile: {
          demo_notes:
            "~$18M ARR narrative, 2,500 customers, 85 employees. Stack: HubSpot, Stripe, Chargebee, NetSuite, Snowflake, Zendesk, Jira, Slack (see change intake).",
        },
      })
      .eq("id", orgId);
    if (updErr) throw updErr;
    console.log(`  Updated org ${ORG_NAME} (${orgId})`);
  } else {
    const { data: org, error: insErr } = await admin
      .from("organizations")
      .insert({
        name: ORG_NAME,
        slug: DEMO_SLUG,
        demo_slug: DEMO_SLUG,
        is_demo: true,
        created_by: ryanId,
        website: "https://solarahealth.example",
        primary_domain: "solarahealth.example",
        industry: "B2B Healthcare SaaS",
        company_size: "51-200",
        demo_profile: {
          demo_notes:
            "~$18M ARR narrative, 2,500 customers, 85 employees. Stack: HubSpot, Stripe, Chargebee, NetSuite, Snowflake, Zendesk, Jira, Slack.",
        },
      })
      .select("id")
      .single();
    if (insErr || !org) throw insErr ?? new Error("org insert failed");
    orgId = org.id as string;
    console.log(`  Created org ${ORG_NAME} (${orgId})`);
  }

  for (const p of PERSONAS) {
    const addr = email(p.local);
    const uid = userIds[addr];
    const { error } = await admin.from("organization_members").upsert(
      { org_id: orgId, user_id: uid, role: p.role },
      { onConflict: "org_id,user_id" }
    );
    if (error) console.warn(`  Member upsert ${addr}:`, error.message);
  }

  await admin.from("organization_settings").upsert(
    {
      org_id: orgId,
      email_enabled: true,
      slack_enabled: false,
      notification_emails: ["revops@solarahealth.example.com"],
    },
    { onConflict: "org_id" }
  );

  await admin.from("org_demo_config").upsert(
    {
      org_id: orgId,
      is_demo_org: true,
      demo_scenario_key: DEMO_SLUG,
      demo_reset_allowed: true,
      demo_external_write_disabled: true,
      last_reset_at: new Date().toISOString(),
      validation_status: "healthy",
    },
    { onConflict: "org_id" }
  );

  await enableDomainForOrg(admin, { orgId, domainKey: "REVENUE" });
  try {
    await enableDomainForOrg(admin, { orgId, domainKey: "SECURITY" });
  } catch {
    // optional domain
  }

  await initializeOnboarding(admin, orgId);

  const roleIds: Record<string, string> = {};
  const roleNames = [
    "Finance Reviewer",
    "Security Reviewer",
    "Billing Owner",
    "Revenue Leadership",
    "Data Reviewer",
  ];
  for (const name of roleNames) {
    const { data: ex } = await admin
      .from("approval_roles")
      .select("id")
      .eq("org_id", orgId)
      .ilike("role_name", name)
      .limit(1)
      .maybeSingle();
    if (ex?.id) {
      roleIds[name] = ex.id;
    } else {
      const { data: created, error } = await admin
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

  const memberMap: Record<string, string[]> = {
    "Finance Reviewer": [danielId],
    "Billing Owner": [priyaId],
    "Data Reviewer": [alexId],
    "Revenue Leadership": [mayaId],
    "Security Reviewer": [emmaId],
  };
  for (const [roleName, ids] of Object.entries(memberMap)) {
    const rid = roleIds[roleName];
    if (!rid) continue;
    for (const uid of ids) {
      await admin.from("approval_role_members").upsert(
        { org_id: orgId, role_id: rid, user_id: uid },
        { onConflict: "role_id,user_id" }
      );
    }
  }

  const mappings = [
    { trigger_type: "DOMAIN", trigger_value: "REVENUE", role: "Finance Reviewer" },
    { trigger_type: "DOMAIN", trigger_value: "SECURITY", role: "Security Reviewer" },
    { trigger_type: "SYSTEM", trigger_value: "Stripe", role: "Billing Owner" },
    { trigger_type: "CHANGE_TYPE", trigger_value: "PRICING", role: "Revenue Leadership" },
    { trigger_type: "CHANGE_TYPE", trigger_value: "BILLING", role: "Billing Owner" },
  ];
  for (const m of mappings) {
    const rid = roleIds[m.role];
    if (!rid) continue;
    const { error } = await admin.from("approval_mappings").insert({
      org_id: orgId,
      trigger_type: m.trigger_type,
      trigger_value: m.trigger_value,
      approval_role_id: rid,
      priority: 100,
      enabled: true,
    });
    if (error?.code !== "23505" && error) {
      console.warn(`  approval_mappings ${m.trigger_type}=${m.trigger_value}:`, error.message);
    }
  }

  for (const p of PERSONAS) {
    const uid = userIds[email(p.local)];
    for (const perm of p.domainPermissions) {
      const d = perm.domain === "FINANCE" ? "REVENUE" : perm.domain;
      if (!["REVENUE", "DATA", "WORKFLOW", "SECURITY"].includes(d)) continue;
      await admin.from("user_domain_permissions").upsert(
        {
          org_id: orgId,
          user_id: uid,
          domain: d,
          can_view: perm.canView,
          can_review: perm.canReview,
        },
        { onConflict: "org_id,user_id,domain" }
      );
    }
  }

  const { data: bs } = await admin
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
      await admin.from("approval_requirements").upsert(row, {
        onConflict: "org_id,domain,risk_bucket,required_role",
      });
    }
    await admin.from("org_bootstrap_status").upsert(
      { org_id: orgId, revenueguard_seeded: true, seeded_at: new Date().toISOString() },
      { onConflict: "org_id" }
    );
  }

  await clearSolaraChangeArtifacts(admin, orgId);

  const stackNote =
    "Systems: HubSpot, Stripe, Chargebee, NetSuite, Snowflake, Zendesk, Jira, Slack. ~$18M ARR, 2,500 customers, 85 employees (narrative).";

  const changes = [
    {
      id: CHANGE_IDS.STRIPE_PRICING_HERO,
      title: "Stripe pricing logic — Growth+ tier & usage-based billing",
      change_type: "PRICING" as const,
      status: "IN_REVIEW" as const,
      domain: "REVENUE",
      systems_involved: ["Stripe", "Chargebee", "NetSuite", "HubSpot"],
      revenue_surface: "PRICING",
      estimated_mrr_affected: 1_150_000,
      revenue_risk_score: 0.895,
      submitted_at: daysAgo(5),
      due_at: daysAgo(-1),
      sla_status: "DUE_SOON",
      created_by: sophieId,
      created_at: daysAgo(8),
      updated_at: daysAgo(1),
      intake: {
        summary:
          "Product initiated Growth+ with usage meters. Billing is concerned about Stripe meter sync; Finance has not signed off on revenue impact; discount stacking rules are ambiguous.",
        demo_anchor: true,
        stack_note: stackNote,
      },
    },
    {
      id: CHANGE_IDS.BILLING_RECON,
      title: "Billing reconciliation patch — Stripe vs NetSuite revenue",
      change_type: "BILLING" as const,
      status: "IN_REVIEW" as const,
      domain: "REVENUE",
      systems_involved: ["Stripe", "NetSuite", "Snowflake"],
      revenue_surface: "BILLING",
      estimated_mrr_affected: 450_000,
      revenue_risk_score: 0.74,
      submitted_at: daysAgo(6),
      due_at: daysAgo(3),
      sla_status: "ON_TRACK",
      created_by: priyaId,
      created_at: daysAgo(9),
      updated_at: daysAgo(2),
      intake: {
        summary:
          "Finance flagged a reporting mismatch. Governance blocked: reconciliation evidence pack not attached; no approvers assigned yet.",
        governance_blocker:
          "Finance approval and reconciliation report required before deploy window.",
        stack_note: stackNote,
      },
    },
    {
      id: CHANGE_IDS.REVREC_Q1,
      title: "Q1 revenue recognition rule update",
      change_type: "REVENUE_INTEGRATION" as const,
      status: "APPROVED" as const,
      domain: "REVENUE",
      systems_involved: ["NetSuite", "Snowflake"],
      revenue_surface: "REPORTING",
      estimated_mrr_affected: 120_000,
      revenue_risk_score: 0.35,
      submitted_at: daysAgo(22),
      due_at: daysAgo(18),
      sla_status: "ON_TRACK",
      created_by: sophieId,
      created_at: daysAgo(24),
      updated_at: daysAgo(17),
      intake: {
        summary: "Completed path: full approval chain, evidence complete, clean audit trail.",
        stack_note: stackNote,
      },
    },
    {
      id: CHANGE_IDS.HUBSPOT_ROUTING,
      title: "HubSpot inbound lead routing — segment + geography",
      change_type: "CRM_SCHEMA" as const,
      status: "IN_REVIEW" as const,
      domain: "REVENUE",
      systems_involved: ["HubSpot", "Jira", "Slack"],
      revenue_surface: "CRM",
      estimated_mrr_affected: 610_000,
      revenue_risk_score: 0.84,
      submitted_at: daysAgo(4),
      due_at: daysAgo(2),
      sla_status: "ON_TRACK",
      created_by: emmaId,
      created_at: daysAgo(7),
      updated_at: daysAgo(1),
      intake: {
        summary:
          "RevOps + Sales (Maya) alignment; engineering dependency on webhook handlers. Risk: leads misrouted to wrong segments.",
        stack_note: stackNote,
      },
    },
    {
      id: CHANGE_IDS.NS_COA,
      title: "NetSuite chart of accounts update",
      change_type: "REVENUE_INTEGRATION" as const,
      status: "IN_REVIEW" as const,
      domain: "REVENUE",
      systems_involved: ["NetSuite", "Snowflake"],
      revenue_surface: "REPORTING",
      estimated_mrr_affected: 520_000,
      revenue_risk_score: 0.86,
      submitted_at: daysAgo(10),
      due_at: daysAgo(4),
      sla_status: "OVERDUE",
      created_by: danielId,
      created_at: daysAgo(12),
      updated_at: daysAgo(3),
      intake: {
        summary:
          "Finance approval delayed; reporting impact under review. Executive visibility: Ryan flagged in standup.",
        stack_note: stackNote,
      },
    },
    {
      id: CHANGE_IDS.PROMO_DISCOUNT,
      title: "Promotional Discount Rollout — Spring Expansion Campaign",
      change_type: "PRICING" as const,
      status: "DRAFT" as const,
      domain: "REVENUE",
      systems_involved: ["Stripe", "Chargebee", "HubSpot"],
      revenue_surface: "PRICING",
      estimated_mrr_affected: null as number | null,
      revenue_risk_score: null as number | null,
      submitted_at: null as string | null,
      due_at: null as string | null,
      sla_status: "ON_TRACK",
      created_by: sophieId,
      created_at: daysAgo(2),
      updated_at: daysAgo(0),
      intake: {
        summary:
          "Product-led discount ladder for expansion; Finance not looped in yet — potential margin impact.",
        stack_note: stackNote,
      },
    },
  ];

  for (const c of changes) {
    const { error } = await admin.from("change_events").insert({
      id: c.id,
      org_id: orgId,
      title: c.title,
      change_type: c.change_type,
      status: c.status,
      domain: c.domain,
      systems_involved: c.systems_involved,
      backfill_required: c.id === CHANGE_IDS.NS_COA,
      intake: c.intake,
      rollout_method: "GRADUAL",
      revenue_surface: c.revenue_surface,
      estimated_mrr_affected: c.estimated_mrr_affected,
      revenue_risk_score: c.revenue_risk_score,
      submitted_at: c.submitted_at,
      due_at: c.due_at,
      sla_status: c.sla_status,
      is_restricted: false,
      created_by: c.created_by,
      created_at: c.created_at,
      updated_at: c.updated_at,
    });
    if (error) throw error;
  }

  // Reviews/blocked queue uses `change_evidence` kinds from `domain_approval_requirements` (REVENUE:
  // EXPOSURE, ROLLBACK_PLAN, MONITORING) when present — that list overrides governance templates.
  await admin.from("change_evidence").insert([
    {
      change_event_id: CHANGE_IDS.STRIPE_PRICING_HERO,
      org_id: orgId,
      kind: "EXPOSURE",
      label: "Revenue exposure worksheet",
      note: "Finance pre-read attached; discount edge cases still open.",
      created_by: emmaId,
    },
    {
      change_event_id: CHANGE_IDS.STRIPE_PRICING_HERO,
      org_id: orgId,
      kind: "ROLLBACK_PLAN",
      label: "Rollback / kill-switch plan",
      created_by: alexId,
    },
    {
      change_event_id: CHANGE_IDS.BILLING_RECON,
      org_id: orgId,
      kind: "EXPOSURE",
      label: "Stripe vs NS variance snapshot",
      created_by: priyaId,
    },
    {
      change_event_id: CHANGE_IDS.REVREC_Q1,
      org_id: orgId,
      kind: "EXPOSURE",
      label: "Exposure sign-off",
      created_by: danielId,
    },
    {
      change_event_id: CHANGE_IDS.REVREC_Q1,
      org_id: orgId,
      kind: "ROLLBACK_PLAN",
      label: "Rollback plan",
      created_by: danielId,
    },
    {
      change_event_id: CHANGE_IDS.REVREC_Q1,
      org_id: orgId,
      kind: "MONITORING",
      label: "Recognition monitoring",
      created_by: danielId,
    },
    {
      change_event_id: CHANGE_IDS.HUBSPOT_ROUTING,
      org_id: orgId,
      kind: "EXPOSURE",
      label: "Pipeline exposure — misroute scenarios",
      created_by: emmaId,
    },
    {
      change_event_id: CHANGE_IDS.HUBSPOT_ROUTING,
      org_id: orgId,
      kind: "ROLLBACK_PLAN",
      label: "Router rollback",
      created_by: alexId,
    },
    {
      change_event_id: CHANGE_IDS.HUBSPOT_ROUTING,
      org_id: orgId,
      kind: "MONITORING",
      label: "Lead SLA dashboards",
      created_by: mayaId,
    },
    {
      change_event_id: CHANGE_IDS.NS_COA,
      org_id: orgId,
      kind: "EXPOSURE",
      label: "Reporting surface impact",
      created_by: danielId,
    },
    {
      change_event_id: CHANGE_IDS.NS_COA,
      org_id: orgId,
      kind: "ROLLBACK_PLAN",
      label: "COA rollback steps",
      created_by: danielId,
    },
    {
      change_event_id: CHANGE_IDS.NS_COA,
      org_id: orgId,
      kind: "MONITORING",
      label: "Close validation checkpoints",
      created_by: danielId,
    },
  ]);

  await admin.from("change_evidence_items").insert([
    {
      change_event_id: CHANGE_IDS.STRIPE_PRICING_HERO,
      org_id: orgId,
      kind: "MONITORING",
      label: "Post-deploy monitoring checklist",
      status: "MISSING",
      severity: "REQUIRED",
    },
    {
      change_event_id: CHANGE_IDS.BILLING_RECON,
      org_id: orgId,
      kind: "ROLLBACK_PLAN",
      label: "Reconciliation rollback / freeze plan",
      status: "MISSING",
      severity: "REQUIRED",
    },
    {
      change_event_id: CHANGE_IDS.BILLING_RECON,
      org_id: orgId,
      kind: "MONITORING",
      label: "Finance monitoring sign-off",
      status: "MISSING",
      severity: "REQUIRED",
    },
  ]);

  await admin.from("approvals").insert([
    {
      change_event_id: CHANGE_IDS.STRIPE_PRICING_HERO,
      org_id: orgId,
      approver_user_id: mayaId,
      approval_area: "Revenue Leadership",
      domain: "REVENUE",
      decision: "APPROVED",
      decided_at: daysAgo(3),
    },
    {
      change_event_id: CHANGE_IDS.STRIPE_PRICING_HERO,
      org_id: orgId,
      approver_user_id: priyaId,
      approval_area: "Billing Owner",
      domain: "REVENUE",
      decision: "PENDING",
    },
    {
      change_event_id: CHANGE_IDS.STRIPE_PRICING_HERO,
      org_id: orgId,
      approver_user_id: danielId,
      approval_area: "Finance Reviewer",
      domain: "REVENUE",
      decision: "PENDING",
    },
    {
      change_event_id: CHANGE_IDS.REVREC_Q1,
      org_id: orgId,
      approver_user_id: danielId,
      approval_area: "Finance Reviewer",
      domain: "REVENUE",
      decision: "APPROVED",
      decided_at: daysAgo(17),
    },
    {
      change_event_id: CHANGE_IDS.HUBSPOT_ROUTING,
      org_id: orgId,
      approver_user_id: mayaId,
      approval_area: "Revenue Leadership",
      domain: "REVENUE",
      decision: "PENDING",
    },
    {
      change_event_id: CHANGE_IDS.HUBSPOT_ROUTING,
      org_id: orgId,
      approver_user_id: alexId,
      approval_area: "Data Reviewer",
      domain: "REVENUE",
      decision: "PENDING",
    },
    {
      change_event_id: CHANGE_IDS.NS_COA,
      org_id: orgId,
      approver_user_id: danielId,
      approval_area: "Finance Reviewer",
      domain: "REVENUE",
      decision: "PENDING",
    },
  ]);

  const nowIso = new Date().toISOString();
  const ia = (
    changeId: string,
    bucket: string,
    raw: number,
    extra?: Record<string, unknown>
  ) => ({
    change_event_id: changeId,
    domain: "REVENUE",
    schema_version: "pass_a_v1",
    status: "READY" as const,
    risk_score_raw: raw,
    risk_bucket: bucket,
    pass_a_output: { seeded: "solara-demo", ...extra },
    pass_a_model: "demo_seed",
    pass_a_ran_at: nowIso,
  });

  await admin.from("impact_assessments").insert([
    ia(CHANGE_IDS.STRIPE_PRICING_HERO, "HIGH", 88, { narrative: "Missing Finance sign-off; incomplete evidence." }),
    ia(CHANGE_IDS.BILLING_RECON, "MEDIUM", 58, { narrative: "Reconciliation pack missing." }),
    ia(CHANGE_IDS.REVREC_Q1, "LOW", 22, { narrative: "Closed loop example." }),
    ia(CHANGE_IDS.HUBSPOT_ROUTING, "HIGH", 80, { narrative: "GTM + engineering coupling." }),
    ia(CHANGE_IDS.NS_COA, "CRITICAL", 90, { narrative: "Reporting surface + overdue approval." }),
  ]);

  const rao = (
    changeId: string,
    bucket: string,
    exposure: number,
    base: number
  ) => ({
    org_id: orgId,
    change_event_id: changeId,
    base_risk_score: base,
    exposure_score: exposure,
    risk_bucket: bucket,
    exposure_bucket: exposure >= 85 ? "HIGH" : exposure >= 70 ? "MED" : "LOW",
    revenue_surface_multiplier: 1,
    mrr_multiplier: 1,
    customer_multiplier: 1,
    top_signal_drivers: [{ key: "demo_seed", weight: 1 }],
  });

  await admin.from("risk_assessment_outputs").insert([
    rao(CHANGE_IDS.STRIPE_PRICING_HERO, "HIGH", 88, 0.88),
    rao(CHANGE_IDS.BILLING_RECON, "MEDIUM", 62, 0.62),
    rao(CHANGE_IDS.REVREC_Q1, "LOW", 28, 0.28),
    rao(CHANGE_IDS.HUBSPOT_ROUTING, "HIGH", 82, 0.82),
    rao(CHANGE_IDS.NS_COA, "CRITICAL", 90, 0.9),
  ]);

  await admin.from("risk_signals").insert([
    {
      change_event_id: CHANGE_IDS.STRIPE_PRICING_HERO,
      domain: "REVENUE",
      category: "FINANCIAL_EXPOSURE",
      signal_key: "pricing_logic_change",
      value_type: "TEXT",
      value_text: "Growth+ meter + discount stacking unclear",
      rationale: "Hero demo anchor",
      confidence: 0.9,
      reasons: [],
      source: "DEMO_SEED",
      weight_at_time: 10,
      contribution: 10,
      created_by: sophieId,
    },
    {
      change_event_id: CHANGE_IDS.HUBSPOT_ROUTING,
      domain: "REVENUE",
      category: "AUTOMATION_INTEGRATION",
      signal_key: "lead_routing_misroute",
      value_type: "TEXT",
      value_text: "Segment/geo matrix not validated in lower envs",
      rationale: "GTM risk",
      confidence: 0.85,
      reasons: [],
      source: "DEMO_SEED",
      weight_at_time: 8,
      contribution: 8,
      created_by: emmaId,
    },
    {
      change_event_id: CHANGE_IDS.NS_COA,
      domain: "REVENUE",
      category: "REPORTING_ACCURACY",
      signal_key: "coa_reporting_drift",
      value_type: "TEXT",
      value_text: "Downstream dashboards depend on legacy account codes",
      rationale: "Exec visibility",
      confidence: 0.88,
      reasons: [],
      source: "DEMO_SEED",
      weight_at_time: 9,
      contribution: 9,
      created_by: danielId,
    },
  ]);

  const reportJson = (failureModes: string[], safeguards: string[], evidence: string[]) => ({
    risk_level: "HIGH",
    confidence: "MEDIUM",
    failure_modes: failureModes,
    safeguards,
    evidence_required: evidence,
  });

  await admin.from("revenue_impact_reports").upsert(
    {
      org_id: orgId,
      change_id: CHANGE_IDS.STRIPE_PRICING_HERO,
      version: 1,
      status: "COMPLETED",
      generated_by: "RULES_ONLY",
      input_hash: "solara-demo-v1",
      report_json: reportJson(
        ["Incorrect pricing applied", "Discounts miscalculated", "Reporting mismatch"],
        ["Finance validation", "Billing QA", "Test transactions"],
        ["Pricing logic spec", "Test results", "Finance approval"]
      ),
      baseline_json: {},
      summary_text:
        "High exposure: Stripe + Chargebee + NetSuite + HubSpot coupling. Finance approval still pending; evidence incomplete.",
      risk_score: 82,
      risk_level: "HIGH",
      is_current: true,
    },
    { onConflict: "change_id,version" }
  );

  await admin.from("revenue_impact_reports").upsert(
    {
      org_id: orgId,
      change_id: CHANGE_IDS.BILLING_RECON,
      version: 1,
      status: "COMPLETED",
      generated_by: "RULES_ONLY",
      input_hash: "solara-demo-v1",
      report_json: reportJson(
        ["Unreconciled cash vs recognized revenue", "Close delay"],
        ["Finance reconciliation", "Stripe payout export"],
        ["Reconciliation workbook", "NetSuite JE tie-out"]
      ),
      baseline_json: {},
      summary_text: "Blocked: reconciliation evidence missing; Finance escalated inconsistency.",
      risk_score: 58,
      risk_level: "MEDIUM",
      is_current: true,
    },
    { onConflict: "change_id,version" }
  );

  await admin.from("coordination_plans").upsert(
    {
      org_id: orgId,
      change_id: CHANGE_IDS.STRIPE_PRICING_HERO,
      version: 1,
      status: "COMPLETED",
      generated_by: "RULES_ONLY",
      input_hash: "solara-demo-v1",
      plan_json: {
        suggested_approvers: [
          { role: "Product", assignee_display: "Sophie Martinez", reason: "Initiated packaging" },
          { role: "Billing Owner", assignee_display: "Priya Shah", reason: "Stripe / Chargebee" },
          { role: "Finance Reviewer", assignee_display: "Daniel Kim", reason: "Revenue integrity" },
        ],
        blockers: [
          {
            message: "Finance approval required before pricing changes go live",
            severity: "HIGH",
          },
        ],
      },
      summary_text: "Cross-team chain: Product → Billing Ops → Finance; evidence gaps on test + discount proof.",
      is_current: true,
    },
    { onConflict: "change_id,version" }
  );

  await admin.from("change_timeline_events").insert([
    {
      org_id: orgId,
      change_event_id: CHANGE_IDS.STRIPE_PRICING_HERO,
      actor_user_id: sophieId,
      event_type: "CHANGE_CREATED",
      title: "Change drafted",
      description: "Sophie Martinez (Product) opened Growth+ pricing work.",
      created_at: daysAgo(8),
    },
    {
      org_id: orgId,
      change_event_id: CHANGE_IDS.STRIPE_PRICING_HERO,
      actor_user_id: sophieId,
      event_type: "CHANGE_SUBMITTED",
      title: "Submitted for review",
      description: "Cross-system scope: Stripe, Chargebee, NetSuite, HubSpot.",
      created_at: daysAgo(5),
    },
    {
      org_id: orgId,
      change_event_id: CHANGE_IDS.STRIPE_PRICING_HERO,
      actor_user_id: mayaId,
      event_type: "APPROVAL_APPROVED",
      title: "Revenue Leadership approved",
      description: "Maya Chen — aligned on GTM packaging risk.",
      created_at: daysAgo(3),
    },
    {
      org_id: orgId,
      change_event_id: CHANGE_IDS.BILLING_RECON,
      actor_user_id: priyaId,
      event_type: "COMMENT_ADDED",
      title: "Governance blocked",
      description:
        "Daniel Kim (Finance) flagged mismatch; reconciliation report not attached. Jordan Lee on point for Zendesk billing tickets if we slip.",
      created_at: daysAgo(2),
    },
    {
      org_id: orgId,
      change_event_id: CHANGE_IDS.BILLING_RECON,
      actor_user_id: jordanId,
      event_type: "COMMENT_ADDED",
      title: "Support readiness",
      description:
        "Jordan Lee (Customer Support): Zendesk macros staged; waiting on reconciliation evidence before customer comms.",
      created_at: daysAgo(1),
    },
    {
      org_id: orgId,
      change_event_id: CHANGE_IDS.REVREC_Q1,
      actor_user_id: danielId,
      event_type: "APPROVAL_APPROVED",
      title: "Finance Reviewer approved",
      description: "Full chain — evidence complete.",
      created_at: daysAgo(17),
    },
    {
      org_id: orgId,
      change_event_id: CHANGE_IDS.NS_COA,
      actor_user_id: ryanId,
      event_type: "COMMENT_ADDED",
      title: "Executive ping",
      description: "Ryan Brooks: need clarity on reporting impact before month-end.",
      created_at: daysAgo(3),
    },
  ]);

  const { data: existingPolicies } = await admin.from("revenue_policies").select("id").eq("org_id", orgId).limit(1);
  if (!existingPolicies?.length) {
    const policyRows = [
      {
        name: "Discount governance",
        description: "Discounts above 25% require Finance + Billing Ops",
        rule_type: "DISCOUNT_LIMIT",
        rule_config: { threshold: 25 },
        systems_affected: ["Stripe", "Chargebee", "HubSpot"],
        enforcement_mode: "REQUIRE_APPROVAL" as const,
      },
      {
        name: "Pricing change approval",
        description: "Pricing logic updates require Product + Finance evidence",
        rule_type: "PRICING_CHANGE",
        rule_config: {},
        systems_affected: ["Stripe", "NetSuite"],
        enforcement_mode: "REQUIRE_APPROVAL" as const,
      },
      {
        name: "Lead routing integrity",
        description: "HubSpot routing changes require RevOps + Sales review",
        rule_type: "CUSTOM",
        rule_config: { intake: "CRM_ROUTING" },
        systems_affected: ["HubSpot", "Jira"],
        enforcement_mode: "MONITOR" as const,
      },
    ];
    for (const p of policyRows) {
      await admin.from("revenue_policies").insert({
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
  console.log("Done. Solara Health demo org is ready.");
  console.log(`  Slug: ${DEMO_SLUG}   is_demo: true`);
  console.log(`  Presenter logins: ${email("ryan.brooks")} or ${email("emma.patel")}`);
  console.log("  Set SOLARA_DEMO_PASSWORD in env, or use the default from the script header comment.");
  console.log(`  Reviewers: ${email("daniel.kim")}, ${email("priya.shah")}, ${email("alex.morgan")}, ${email("maya.chen")}, ${email("jordan.lee")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
