import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auditLog } from "@/lib/audit";
import { authStateFromUser, requireVerifiedResponse } from "@/lib/auth";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

type BootstrapRequest = {
  orgId: string;
};

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();

  // 1️⃣ Auth
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userRes?.user) {
    return json(401, { ok: false, error: "unauthorized" });
  }
  const forbidden = requireVerifiedResponse(authStateFromUser(userRes.user));
  if (forbidden) return forbidden;
  const userId = userRes.user.id;

  // 2️⃣ Parse body
  let body: BootstrapRequest;
  try {
    body = (await req.json()) as BootstrapRequest;
  } catch {
    return json(400, { ok: false, error: "invalid_json" });
  }

  const orgId = body?.orgId;
  if (!orgId) return json(400, { ok: false, error: "missing_orgId" });

  // 3️⃣ Membership check (user-scoped)
  const { data: memberRow, error: memErr } = await supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (memErr) return json(500, { ok: false, error: memErr.message });
  if (!memberRow) return json(403, { ok: false, error: "forbidden" });
  if (!isAdminLikeRole(parseOrgRole((memberRow as { role?: string | null }).role ?? null))) {
    return json(403, { ok: false, error: "owner_or_admin_required" });
  }

  const admin = createAdminClient();

  // 4️⃣ Check bootstrap status
  const { data: bsRow, error: bsErr } = await admin
    .from("org_bootstrap_status")
    .select("org_id, revenueguard_seeded")
    .eq("org_id", orgId)
    .maybeSingle();

  if (bsErr) return json(500, { ok: false, error: bsErr.message });

  if (!bsRow) {
    const { error: insErr } = await admin
      .from("org_bootstrap_status")
      .insert({ org_id: orgId, revenueguard_seeded: false });

    if (insErr) return json(500, { ok: false, error: insErr.message });
  } else if (bsRow.revenueguard_seeded) {
    return json(200, { ok: true, seeded: false, alreadySeeded: true });
  }

  // -------------------------
  // Seed Signal Definitions
  // -------------------------
  const seedSignalDefinitions = [
    {
      signal_key: "affects_active_billing_system",
      domain: "REVENUE",
      category: "Financial Exposure",
      value_type: "BOOLEAN",
      base_weight: 5,
      enabled: true,
      description: "Touches active billing runtime (Stripe/billing service).",
    },
    {
      signal_key: "modifies_pricing_logic",
      domain: "REVENUE",
      category: "Financial Exposure",
      value_type: "BOOLEAN",
      base_weight: 5,
      enabled: true,
      description: "Changes pricing rules (plans, tiers, calculations).",
    },
    {
      signal_key: "backfill_required",
      domain: "REVENUE",
      category: "Financial Exposure",
      value_type: "BOOLEAN",
      base_weight: 4,
      enabled: true,
      description: "Historical backfill required.",
    },
    {
      signal_key: "data_migration_required",
      domain: "REVENUE",
      category: "Data Integrity",
      value_type: "BOOLEAN",
      base_weight: 4,
      enabled: true,
      description: "Requires migrating revenue-related data.",
    },
    {
      signal_key: "requires_database_migration",
      domain: "REVENUE",
      category: "Rollback Complexity",
      value_type: "BOOLEAN",
      base_weight: 4,
      enabled: true,
      description: "DB migration required; rollback non-trivial.",
    },
    {
      signal_key: "no_rollback_path_defined",
      domain: "REVENUE",
      category: "Rollback Complexity",
      value_type: "BOOLEAN",
      base_weight: 4,
      enabled: true,
      description: "No rollback plan attached.",
    },
  ];

  const { error: sdErr } = await admin
    .from("signal_definitions")
    .upsert(seedSignalDefinitions, { onConflict: "signal_key" });

  if (sdErr) {
    return json(500, {
      ok: false,
      error: `signal_definitions_seed_failed: ${sdErr.message}`,
    });
  }

  // -------------------------
  // Seed Mitigations
  // -------------------------
  const seedMitigations = [
    {
      signal_key: "backfill_required",
      domain: "REVENUE",
      severity: "HIGH",
      recommendation:
        "Run backfill dry-run on a small cohort before full execution.",
      evidence_kind: "TEST_PLAN",
    },
    {
      signal_key: "requires_database_migration",
      domain: "REVENUE",
      severity: "HIGH",
      recommendation:
        "Attach rollback SQL and verify down migration in staging.",
      evidence_kind: "ROLLBACK_PLAN",
    },
  ];

  const { error: smErr } = await admin
    .from("signal_mitigations")
    .upsert(seedMitigations, {
      onConflict: "signal_key,domain,recommendation",
    });

  if (smErr) {
    return json(500, {
      ok: false,
      error: `signal_mitigations_seed_failed: ${smErr.message}`,
    });
  }

  // Phase 1A Pass 2 — Seed org-scoped revenue mitigations (idempotent)
  const { error: seedMitErr } = await admin.rpc("seed_revenue_mitigations", {
    p_org_id: orgId,
  });
  if (seedMitErr) {
    // Non-fatal: RPC may not exist if migration 063 not applied
    console.warn("seed_revenue_mitigations RPC:", seedMitErr.message);
  }

  // Phase 3 — Enable REVENUE domain (org_domains, org_domain_policies, org_signal_overrides)
  try {
    const { enableDomainForOrg } = await import("@/services/domains/enableDomainForOrg");
    await enableDomainForOrg(admin, { orgId, domainKey: "REVENUE" });
  } catch (e) {
    console.warn("enableDomainForOrg:", e);
  }

  // -------------------------
  // Seed Approval Requirements (org-scoped)
  // -------------------------
  const approvalSeed = [
    { org_id: orgId, domain: "REVENUE", risk_bucket: "LOW", required_role: "DOMAIN_REVIEWER", min_count: 1 },
    { org_id: orgId, domain: "REVENUE", risk_bucket: "MEDIUM", required_role: "DOMAIN_REVIEWER", min_count: 1 },
    { org_id: orgId, domain: "REVENUE", risk_bucket: "HIGH", required_role: "DOMAIN_REVIEWER", min_count: 1 },
    { org_id: orgId, domain: "REVENUE", risk_bucket: "HIGH", required_role: "RISK_OWNER", min_count: 1 },
    { org_id: orgId, domain: "REVENUE", risk_bucket: "CRITICAL", required_role: "DOMAIN_REVIEWER", min_count: 1 },
    { org_id: orgId, domain: "REVENUE", risk_bucket: "CRITICAL", required_role: "RISK_OWNER", min_count: 1 },
    { org_id: orgId, domain: "REVENUE", risk_bucket: "CRITICAL", required_role: "EXEC", min_count: 1 },
  ];

  const { error: arErr } = await admin
    .from("approval_requirements")
    .upsert(approvalSeed, {
      onConflict: "org_id,domain,risk_bucket,required_role",
    });

  if (arErr) {
    return json(500, {
      ok: false,
      error: `approval_requirements_seed_failed: ${arErr.message}`,
    });
  }

  // Mark seeded
  const { error: markErr } = await admin
    .from("org_bootstrap_status")
    .update({
      revenueguard_seeded: true,
      seeded_at: new Date().toISOString(),
    })
    .eq("org_id", orgId);

  if (markErr) return json(500, { ok: false, error: markErr.message });

  // 5️⃣ Audit
  await auditLog(supabase, {
    orgId,
    actorId: userId,
    actorType: "USER",
    action: "org_bootstrapped",
    entityType: "org",
    entityId: orgId,
    metadata: {
      domain: "REVENUE",
      seeded: true,
    },
  });

  return json(200, { ok: true, seeded: true, alreadySeeded: false });
}
