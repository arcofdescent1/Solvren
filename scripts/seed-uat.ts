#!/usr/bin/env npx tsx
/**
 * Pass 5 — UAT Seed Data and Demo Dataset
 *
 * Creates a deterministic, realistic seeded environment for UAT, beta demos,
 * and workflow validation.
 *
 * Usage:
 *   npx tsx scripts/seed-uat.ts
 *
 * Prerequisites:
 *   - .env.local with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   - Supabase project with migrations applied
 *
 * See docs/UAT_SEED_DATA.md for full documentation.
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load .env.local
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

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set in .env.local");
  process.exit(1);
}

const UAT_PASSWORD = process.env.UAT_SEED_PASSWORD ?? "UAT-Pass5-Demo!";

// Fixed reference timestamp for deterministic dates (2025-01-15 12:00 UTC)
const SEED_REF = new Date("2025-01-15T12:00:00Z").getTime();
const ts = (daysOffset: number) =>
  new Date(SEED_REF + daysOffset * 24 * 60 * 60 * 1000).toISOString();

// Deterministic UUIDs for changes (stable across runs)
const CHANGE_IDS = {
  PRICING_HIGH_RISK: "11111111-1111-5000-8000-000000000001",
  BILLING_BLOCKED: "11111111-1111-5000-8000-000000000002",
  REVENUE_RECOGNITION_APPROVED: "11111111-1111-5000-8000-000000000003",
  LEAD_ROUTING: "11111111-1111-5000-8000-000000000004",
  RESTRICTED_SECURITY: "11111111-1111-5000-8000-000000000005",
  OVERDUE_APPROVAL: "11111111-1111-5000-8000-000000000006",
  DRAFT_IN_PROGRESS: "11111111-1111-5000-8000-000000000007",
  REJECTED_REVISED: "11111111-1111-5000-8000-000000000008",
} as const;

// Persona definitions (Workstream 1)
const PERSONAS = [
  {
    email: "owner@uat.solvren.test",
    displayName: "Olivia Owner",
    role: "owner" as const,
    domainPermissions: [] as { domain: string; canView: boolean; canReview: boolean }[],
    approvalRoles: [] as string[],
  },
  {
    email: "admin@uat.solvren.test",
    displayName: "Adam Admin",
    role: "admin" as const,
    domainPermissions: [],
    approvalRoles: [],
  },
  {
    email: "submitter@uat.solvren.test",
    displayName: "Sophie Submitter",
    role: "submitter" as const,
    domainPermissions: [{ domain: "REVENUE", canView: true, canReview: false }],
    approvalRoles: [],
  },
  {
    email: "reviewer@uat.solvren.test",
    displayName: "Riley Reviewer",
    role: "reviewer" as const,
    domainPermissions: [{ domain: "REVENUE", canView: true, canReview: true }],
    approvalRoles: ["Data Reviewer"],
  },
  {
    email: "viewer@uat.solvren.test",
    displayName: "Victor Viewer",
    role: "viewer" as const,
    domainPermissions: [{ domain: "REVENUE", canView: true, canReview: false }],
    approvalRoles: [],
  },
  {
    email: "finance@uat.solvren.test",
    displayName: "Fiona Finance",
    role: "reviewer" as const,
    domainPermissions: [{ domain: "REVENUE", canView: true, canReview: true }, { domain: "FINANCE", canView: true, canReview: true }],
    approvalRoles: ["Finance Reviewer"],
  },
  {
    email: "security@uat.solvren.test",
    displayName: "Sam Security",
    role: "reviewer" as const,
    domainPermissions: [{ domain: "REVENUE", canView: true, canReview: true }, { domain: "SECURITY", canView: true, canReview: true }],
    approvalRoles: ["Security Reviewer"],
  },
  {
    email: "restricted@uat.solvren.test",
    displayName: "Renee Restricted",
    role: "reviewer" as const,
    domainPermissions: [{ domain: "REVENUE", canView: true, canReview: false }],
    approvalRoles: [],
    hasExplicitChangeAccess: true,
  },
] as const;

async function main() {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE!, {
    auth: { persistSession: false },
  });

  console.log("Pass 5 — UAT Seed");
  console.log("==================");

  // 1. Create or fetch personas
  const userIds: Record<string, string> = {};
  const { data: existingUsers } = await supabase.auth.admin.listUsers({ perPage: 500 });
  for (const p of PERSONAS) {
    const found = existingUsers?.users?.find((u) => u.email === p.email);
    if (found) {
      userIds[p.email] = found.id;
      // Ensure existing UAT users are verified and have current password (e2e login)
      const { error: updateErr } = await supabase.auth.admin.updateUserById(found.id, {
        password: UAT_PASSWORD,
        email_confirm: true,
      });
      if (updateErr) {
        console.warn(`  Warning: could not update ${p.email} (${updateErr.message})`);
      }
      console.log(`  Persona exists: ${p.displayName} (${p.email})`);
    } else {
      const { data: created, error } = await supabase.auth.admin.createUser({
        email: p.email,
        password: UAT_PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: p.displayName },
      });
      if (error) {
        console.error(`  Failed to create ${p.email}:`, error.message);
        throw error;
      }
      userIds[p.email] = created.user.id;
      console.log(`  Created persona: ${p.displayName} (${p.email})`);
    }
  }

  const ownerId = userIds["owner@uat.solvren.test"];
  const submitterId = userIds["submitter@uat.solvren.test"];
  const reviewerId = userIds["reviewer@uat.solvren.test"];
  const financeId = userIds["finance@uat.solvren.test"];
  const securityId = userIds["security@uat.solvren.test"];
  const restrictedId = userIds["restricted@uat.solvren.test"];

  // 2. Create or fetch org "Acme Revenue Ops"
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", "Acme Revenue Ops")
    .limit(1);

  let orgId: string;
  if (orgs?.length) {
    orgId = orgs[0].id;
    console.log(`  Org exists: Acme Revenue Ops (${orgId})`);
  } else {
    const { data: org, error } = await supabase
      .from("organizations")
      .insert({
        name: "Acme Revenue Ops",
        created_by: ownerId,
      })
      .select("id")
      .single();
    if (error) throw error;
    orgId = org!.id;
    console.log(`  Created org: Acme Revenue Ops (${orgId})`);
  }

  // 3. Add members
  for (const p of PERSONAS) {
    const uid = userIds[p.email];
    const { error } = await supabase.from("organization_members").upsert(
      { org_id: orgId, user_id: uid, role: p.role },
      { onConflict: "org_id,user_id" }
    );
    if (error) console.warn(`  Member upsert ${p.email}:`, error.message);
  }
  console.log("  Members synced");

  // 4. Org settings
  await supabase.from("organization_settings").upsert(
    {
      org_id: orgId,
      email_enabled: true,
      slack_enabled: false,
      notification_emails: ["ops@acme.example.com"],
    },
    { onConflict: "org_id" }
  );

  // 5. Enable REVENUE and SECURITY domains for org
  const { enableDomainForOrg } = await import("../src/services/domains/enableDomainForOrg");
  await enableDomainForOrg(supabase, { orgId, domainKey: "REVENUE" });
  try {
    await enableDomainForOrg(supabase, { orgId, domainKey: "SECURITY" });
  } catch {
    // SECURITY domain may not exist in older migrations
  }

  // 6. Approval roles
  const roleIds: Record<string, string> = {};
  const roleNames = [
    "Finance Reviewer",
    "Security Reviewer",
    "Billing Owner",
    "Revenue Leadership",
    "Data Reviewer",
  ];
  for (const name of roleNames) {
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
        console.warn(`  Approval role ${name}:`, error.message);
        continue;
      }
      roleIds[name] = created!.id;
    }
  }

  // 7. Approval role members
  const adminId = userIds["admin@uat.solvren.test"];
  const memberMap: Record<string, string[]> = {
    "Finance Reviewer": [financeId],
    "Security Reviewer": [securityId],
    "Data Reviewer": [reviewerId],
    "Billing Owner": [adminId],
  };
  for (const [roleName, userIdsForRole] of Object.entries(memberMap)) {
    const rid = roleIds[roleName];
    if (!rid) continue;
    for (const uid of userIdsForRole) {
      if (!uid) continue;
      await supabase.from("approval_role_members").upsert(
        { org_id: orgId, role_id: rid, user_id: uid },
        { onConflict: "role_id,user_id" }
      );
    }
  }
  if (roleIds["Billing Owner"] && adminId) {
    await supabase.from("approval_role_members").upsert(
      { org_id: orgId, role_id: roleIds["Billing Owner"], user_id: adminId },
      { onConflict: "role_id,user_id" }
    );
  }
  console.log("  Approval roles and members synced");

  // 8. Approval mappings
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
    const { error } = await supabase.from("approval_mappings").insert({
      org_id: orgId,
      trigger_type: m.trigger_type,
      trigger_value: m.trigger_value,
      approval_role_id: rid,
      priority: 100,
      enabled: true,
    });
    if (error?.code === "23505") {
      // unique violation - already exists
    } else if (error) {
      console.warn(`  Approval mapping ${m.trigger_type}=${m.trigger_value}:`, error.message);
    }
  }

  // 9. User domain permissions
  for (const p of PERSONAS) {
    const uid = userIds[p.email];
    for (const perm of p.domainPermissions) {
      const domainExists = ["REVENUE", "DATA", "WORKFLOW", "SECURITY"].includes(perm.domain);
      if (!domainExists) continue; // FINANCE may not exist; use REVENUE
      const domain = perm.domain === "FINANCE" ? "REVENUE" : perm.domain;
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

  // 10. Bootstrap org (signals, mitigations, approval requirements)
  await import("../src/services/domains/enableDomainForOrg");
  // Already enabled REVENUE; bootstrap API seeds approval_requirements - we can call it or seed manually
  // For simplicity we rely on enableDomainForOrg and manual approval_requirements
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

  // 11. Seed sample changes (Workstream 3 & 4)
  const changes = [
    {
      id: CHANGE_IDS.PRICING_HIGH_RISK,
      title: "Stripe Pricing Logic Update",
      change_type: "PRICING",
      status: "IN_REVIEW",
      domain: "REVENUE",
      systems_involved: ["Stripe", "Chargebee"],
      backfill_required: false,
      rollout_method: "IMMEDIATE",
      revenue_surface: "PRICING",
      submitted_at: ts(-3),
      due_at: ts(2),
      sla_status: "ON_TRACK",
      is_restricted: false,
      created_by: submitterId,
      created_at: ts(-5),
      updated_at: ts(-2),
      ready_at: ts(-3),
    },
    {
      id: CHANGE_IDS.BILLING_BLOCKED,
      title: "Billing Reconciliation Patch",
      change_type: "BILLING",
      status: "IN_REVIEW",
      domain: "REVENUE",
      systems_involved: ["Stripe", "NetSuite"],
      backfill_required: false,
      revenue_surface: "BILLING",
      submitted_at: ts(-2),
      due_at: ts(1),
      sla_status: "ON_TRACK",
      is_restricted: false,
      created_by: submitterId,
      created_at: ts(-4),
      updated_at: ts(-1),
      ready_at: ts(-2),
    },
    {
      id: CHANGE_IDS.REVENUE_RECOGNITION_APPROVED,
      title: "Q1 Revenue Recognition Rule Update",
      change_type: "REVENUE_INTEGRATION",
      status: "APPROVED",
      domain: "REVENUE",
      systems_involved: ["NetSuite"],
      backfill_required: false,
      revenue_surface: "REPORTING",
      submitted_at: ts(-14),
      due_at: ts(-10),
      sla_status: "ON_TRACK",
      is_restricted: false,
      created_by: submitterId,
      created_at: ts(-16),
      updated_at: ts(-9),
      ready_at: null,
    },
    {
      id: CHANGE_IDS.LEAD_ROUTING,
      title: "HubSpot to Salesforce Lead Routing Sync",
      change_type: "CRM_SCHEMA",
      status: "DRAFT",
      domain: "REVENUE",
      systems_involved: ["HubSpot", "Salesforce"],
      backfill_required: false,
      revenue_surface: "CRM",
      is_restricted: false,
      created_by: submitterId,
      created_at: ts(-1),
      updated_at: ts(0),
    },
    {
      id: CHANGE_IDS.RESTRICTED_SECURITY,
      title: "Security Review for Billing Auth Hardening",
      change_type: "OTHER",
      status: "IN_REVIEW",
      domain: "SECURITY",
      systems_involved: ["Stripe", "Okta"],
      backfill_required: false,
      is_restricted: true,
      created_by: submitterId,
      created_at: ts(-4),
      updated_at: ts(-2),
      submitted_at: ts(-3),
    },
    {
      id: CHANGE_IDS.OVERDUE_APPROVAL,
      title: "NetSuite Chart of Accounts Update",
      change_type: "REVENUE_INTEGRATION",
      status: "IN_REVIEW",
      domain: "REVENUE",
      systems_involved: ["NetSuite"],
      backfill_required: true,
      submitted_at: ts(-5),
      due_at: ts(-2), // overdue
      sla_status: "OVERDUE",
      is_restricted: false,
      created_by: submitterId,
      created_at: ts(-7),
      updated_at: ts(-2),
    },
    {
      id: CHANGE_IDS.DRAFT_IN_PROGRESS,
      title: "Chargebee Plan Migration Draft",
      change_type: "BILLING",
      status: "DRAFT",
      domain: "REVENUE",
      systems_involved: ["Chargebee"],
      backfill_required: true,
      is_restricted: false,
      created_by: submitterId,
      created_at: ts(-2),
      updated_at: ts(0),
    },
    {
      id: CHANGE_IDS.REJECTED_REVISED,
      title: "Pricing Tier Rename — Revised",
      change_type: "PRICING",
      status: "DRAFT",
      domain: "REVENUE",
      systems_involved: ["Stripe"],
      backfill_required: false,
      is_restricted: false,
      created_by: submitterId,
      created_at: ts(-10),
      updated_at: ts(-1),
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
        backfill_required: c.backfill_required ?? false,
        intake: {},
        rollout_method: c.rollout_method ?? null,
        revenue_surface: c.revenue_surface ?? null,
        submitted_at: c.submitted_at ?? null,
        due_at: c.due_at ?? null,
        sla_status: c.sla_status ?? "ON_TRACK",
        is_restricted: c.is_restricted ?? false,
        created_by: c.created_by,
        created_at: c.created_at,
        updated_at: c.updated_at,
        ready_at: c.ready_at ?? null,
      },
      { onConflict: "id" }
    );
    if (error) {
      console.warn(`  Change ${c.title}:`, error.message);
    }
  }
  console.log("  Sample changes seeded");

  // Evidence items — BILLING_BLOCKED has missing required (delete+insert for idempotency)
  await supabase
    .from("change_evidence_items")
    .delete()
    .in("change_event_id", Object.values(CHANGE_IDS));
  const evidenceRows = [
    { change_event_id: CHANGE_IDS.PRICING_HIGH_RISK, kind: "ROLLBACK_PLAN", label: "Rollback plan", status: "PROVIDED" as const, severity: "REQUIRED" as const },
    { change_event_id: CHANGE_IDS.PRICING_HIGH_RISK, kind: "TEST_PLAN", label: "Test plan", status: "PROVIDED" as const, severity: "REQUIRED" as const },
    { change_event_id: CHANGE_IDS.BILLING_BLOCKED, kind: "ROLLBACK_PLAN", label: "Rollback plan", status: "MISSING" as const, severity: "REQUIRED" as const },
    { change_event_id: CHANGE_IDS.BILLING_BLOCKED, kind: "TEST_PLAN", label: "Test plan", status: "MISSING" as const, severity: "REQUIRED" as const },
    { change_event_id: CHANGE_IDS.REVENUE_RECOGNITION_APPROVED, kind: "ROLLBACK_PLAN", label: "Rollback plan", status: "PROVIDED" as const, severity: "REQUIRED" as const },
    { change_event_id: CHANGE_IDS.REVENUE_RECOGNITION_APPROVED, kind: "TEST_PLAN", label: "Test plan", status: "PROVIDED" as const, severity: "REQUIRED" as const },
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

  // Approvals — OVERDUE has pending; REVENUE_RECOGNITION has completed
  await supabase
    .from("approvals")
    .delete()
    .in("change_event_id", Object.values(CHANGE_IDS));
  await supabase.from("approvals").insert(
    [
      {
        change_event_id: CHANGE_IDS.OVERDUE_APPROVAL,
        org_id: orgId,
        approver_user_id: financeId,
        approval_area: "Finance Reviewer",
        domain: "REVENUE",
        decision: "PENDING",
      },
      {
        change_event_id: CHANGE_IDS.REVENUE_RECOGNITION_APPROVED,
        org_id: orgId,
        approver_user_id: financeId,
        approval_area: "Finance Reviewer",
        domain: "REVENUE",
        decision: "APPROVED",
        decided_at: ts(-9),
      },
    ]
  );

  // Restricted change: grant Renee explicit access
  await supabase.from("change_permissions").upsert(
    {
      org_id: orgId,
      change_event_id: CHANGE_IDS.RESTRICTED_SECURITY,
      user_id: restrictedId,
      access_type: "VIEW",
    },
    { onConflict: "change_event_id,user_id,access_type", ignoreDuplicates: true }
  );

  // Revenue impact reports for hero changes
  const { error: rirErr } = await supabase.from("revenue_impact_reports").upsert(
    {
      org_id: orgId,
      change_id: CHANGE_IDS.PRICING_HIGH_RISK,
      version: 1,
      status: "COMPLETED",
      generated_by: "RULES_ONLY",
      input_hash: "seed-uat-v1",
      report_json: {
        summary: "High risk: Stripe pricing logic changes affect all active subscriptions.",
        risk_factors: ["modifies_pricing_logic", "impacts_active_customers"],
      },
      baseline_json: {},
      summary_text: "High revenue exposure. Finance and Billing approvals recommended.",
      risk_score: 78,
      risk_level: "HIGH",
      is_current: true,
    },
    { onConflict: "change_id,version" }
  );
  if (rirErr) console.warn("  Revenue impact report:", rirErr.message);

  // Coordination plans
  const { error: cpErr } = await supabase.from("coordination_plans").upsert(
    {
      org_id: orgId,
      change_id: CHANGE_IDS.PRICING_HIGH_RISK,
      version: 1,
      status: "COMPLETED",
      generated_by: "RULES_ONLY",
      input_hash: "seed-uat-v1",
      plan_json: {
        suggested_approvers: [
          { role: "Finance Reviewer", reason: "Domain: Finance" },
          { role: "Billing Owner", reason: "System: Stripe" },
        ],
      },
      summary_text: "Finance Reviewer, Billing Owner suggested.",
      is_current: true,
    },
    { onConflict: "change_id,version" }
  );
  if (cpErr) console.warn("  Coordination plan:", cpErr.message);

  // Timeline events
  const timelineEvents = [
    {
      org_id: orgId,
      change_event_id: CHANGE_IDS.PRICING_HIGH_RISK,
      actor_user_id: submitterId,
      event_type: "CHANGE_CREATED",
      title: "Change created",
      description: "Draft created",
      created_at: ts(-5),
    },
    {
      org_id: orgId,
      change_event_id: CHANGE_IDS.PRICING_HIGH_RISK,
      actor_user_id: submitterId,
      event_type: "CHANGE_SUBMITTED",
      title: "Submitted for review",
      description: null,
      created_at: ts(-3),
    },
    {
      org_id: orgId,
      change_event_id: CHANGE_IDS.REVENUE_RECOGNITION_APPROVED,
      actor_user_id: financeId,
      event_type: "APPROVAL_APPROVED",
      title: "Finance Reviewer approved",
      description: "LGTM",
      created_at: ts(-9),
    },
    {
      org_id: orgId,
      change_event_id: CHANGE_IDS.REJECTED_REVISED,
      actor_user_id: reviewerId,
      event_type: "CHANGE_REJECTED",
      title: "Change rejected",
      description: "Please revise pricing labels",
      created_at: ts(-8),
    },
  ];
  for (const ev of timelineEvents) {
    await supabase.from("change_timeline_events").insert(ev).then((r) => {
      if (r.error && !r.error.message?.includes("duplicate")) console.warn("Timeline:", r.error.message);
    });
  }

  // 12. Risk events (for dashboard, activity feed, copilot) — replace org risk events for deterministic seed
  await supabase.from("risk_events").delete().eq("org_id", orgId);
  const riskEventRows = [
    { provider: "Jira", object: "Issue", object_id: "PRC-182", risk_type: "pricing_change", risk_score: 92, risk_bucket: "HIGH", impact_amount: 420000, change_event_id: CHANGE_IDS.PRICING_HIGH_RISK, approved_at: null, timestamp: ts(-1), field: "Discount", old_value: 20, new_value: 45 },
    { provider: "Jira", object: "Issue", object_id: "BIL-101", risk_type: "billing_config", risk_score: 65, risk_bucket: "MODERATE", impact_amount: 90000, change_event_id: CHANGE_IDS.REVENUE_RECOGNITION_APPROVED, approved_at: ts(-9), timestamp: ts(-5), field: null, old_value: null, new_value: null },
    { provider: "Salesforce", object: "Opportunity", object_id: "OPP-2048", risk_type: "discount_change", risk_score: 88, risk_bucket: "HIGH", impact_amount: 180000, change_event_id: null, approved_at: null, timestamp: ts(0), field: "Discount__c", old_value: 15, new_value: 35 },
    { provider: "NetSuite", object: "PriceBook", object_id: "PB-12", risk_type: "pricing_rule", risk_score: 75, risk_bucket: "MODERATE", impact_amount: 120000, change_event_id: null, approved_at: null, timestamp: ts(-2), field: null, old_value: null, new_value: null },
    { provider: "Stripe", object: "Product", object_id: "prod_abc", risk_type: "price_update", risk_score: 95, risk_bucket: "CRITICAL", impact_amount: 550000, change_event_id: null, approved_at: null, timestamp: ts(-3), field: "unit_amount", old_value: 9900, new_value: 14900 },
  ];
  for (const r of riskEventRows) {
    const { error: insErr } = await supabase.from("risk_events").insert({
      org_id: orgId,
      provider: r.provider,
      object: r.object,
      object_id: r.object_id,
      risk_type: r.risk_type,
      risk_score: r.risk_score,
      risk_bucket: r.risk_bucket,
      impact_amount: r.impact_amount,
      change_event_id: r.change_event_id,
      approved_at: r.approved_at,
      timestamp: r.timestamp,
      field: r.field,
      old_value: r.old_value,
      new_value: r.new_value,
    });
    if (insErr) console.warn("  Risk event:", insErr.message);
  }
  console.log("  Risk events seeded");

  // 13. Revenue policies (control layer) — only seed if org has none
  const { data: existingPolicies } = await supabase.from("revenue_policies").select("id").eq("org_id", orgId).limit(1);
  if (!existingPolicies?.length) {
  const policyRows = [
    { name: "Discount Limits", description: "Discounts above 30% require Finance approval", rule_type: "DISCOUNT_LIMIT", rule_config: { threshold: 30 }, systems_affected: ["Salesforce", "Jira"], enforcement_mode: "REQUIRE_APPROVAL" as const },
    { name: "Pricing Change Approval", description: "Pricing changes require approval", rule_type: "PRICING_CHANGE", rule_config: {}, systems_affected: ["Stripe", "NetSuite"], enforcement_mode: "REQUIRE_APPROVAL" as const },
    { name: "Block Excessive Discounts", description: "Block discounts over 50%", rule_type: "DISCOUNT_LIMIT", rule_config: { threshold: 50 }, systems_affected: ["Salesforce"], enforcement_mode: "BLOCK" as const },
    { name: "Monitor Billing Rules", description: "Log billing logic changes", rule_type: "BILLING_RULE", rule_config: {}, systems_affected: [], enforcement_mode: "MONITOR" as const },
  ];
  for (const p of policyRows) {
    const { error: insErr } = await supabase.from("revenue_policies").insert({
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
    if (insErr) console.warn("  Revenue policy:", insErr.message);
  }
  console.log("  Revenue policies seeded");
  }

  console.log("");
  console.log("Done. Personas, org, settings, sample changes, risk events, and policies seeded.");
  console.log("See docs/UAT_SEED_DATA.md or docs/UAT_CREDENTIALS.md for login details.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
