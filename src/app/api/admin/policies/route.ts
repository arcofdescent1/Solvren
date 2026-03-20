/**
 * Phase 3 — GET /api/admin/policies, POST /api/admin/policies.
 * Phase 2 Gap 2 — Pagination, search, includeArchived, enhanced response.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listPolicies, insertPolicy } from "@/modules/policy/repositories/policies.repository";
import { validatePolicyDraft } from "@/modules/policy/services/policy-validation.service";

async function getOrgId(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return null;
  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (membership as { org_id: string } | null)?.org_id ?? null;
}

function hasHardBlock(rules: unknown[]): boolean {
  return (rules as Array<{ hardBlock?: boolean; effect?: { type?: string } }>).some(
    (r) => r.hardBlock && r.effect?.type === "BLOCK"
  );
}

function hasApprovalRules(rules: unknown[]): boolean {
  return (rules as Array<{ effect?: { type?: string } }>).some((r) => r.effect?.type === "REQUIRE_APPROVAL");
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const orgId = await getOrgId(supabase);
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const scope = searchParams.get("scope") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const includeArchived = searchParams.get("includeArchived") === "true";
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") ?? "25", 10), 100);

  const { data, total, error } = await listPolicies(supabase, orgId, {
    status,
    scope,
    search,
    includeArchived,
    page,
    pageSize,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = (data ?? []).map((p) => ({
    id: p.id,
    policyKey: p.policy_key,
    displayName: p.display_name,
    scope: p.scope,
    scopeRef: p.scope_ref,
    status: p.status,
    priorityOrder: p.priority_order,
    version: p.version ?? 1,
    ruleCount: (p.rules_json as unknown[])?.length ?? 0,
    hasHardBlock: hasHardBlock((p.rules_json as unknown[]) ?? []),
    hasApprovalRules: hasApprovalRules((p.rules_json as unknown[]) ?? []),
    updatedAt: p.updated_at,
    effectiveFrom: p.effective_from,
    effectiveTo: p.effective_to,
  }));

  return NextResponse.json({
    items,
    page,
    pageSize,
    total: total ?? items.length,
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = await getOrgId(supabase);
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  let body: {
    policyKey?: string;
    displayName?: string;
    description?: string;
    scope?: string;
    scopeRef?: string | null;
    priorityOrder?: number;
    status?: string;
    defaultDisposition?: string;
    rules?: unknown[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.policyKey || !body.displayName || !body.defaultDisposition) {
    return NextResponse.json({ error: "policyKey, displayName, defaultDisposition required" }, { status: 400 });
  }

  const validation = validatePolicyDraft({
    displayName: body.displayName,
    policyKey: body.policyKey,
    scope: body.scope,
    scopeRef: body.scopeRef,
    defaultDisposition: body.defaultDisposition,
    rules: body.rules as import("@/modules/policy/domain").PolicyRule[],
  });
  if (!validation.valid && body.status === "active") {
    return NextResponse.json({ error: "Validation failed", errors: validation.errors }, { status: 400 });
  }

  const { data, error } = await insertPolicy(supabase, {
    org_id: orgId,
    policy_key: body.policyKey,
    display_name: body.displayName ?? body.policyKey,
    description: body.description ?? "",
    scope: body.scope ?? "action",
    scope_ref: body.scopeRef ?? null,
    priority_order: body.priorityOrder ?? 100,
    status: body.status ?? "active",
    default_disposition: body.defaultDisposition,
    rules_json: body.rules ?? [],
    created_by_user_id: userRes.user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Create failed" }, { status: 500 });

  return NextResponse.json({ policy: data });
}
