/**
 * Phase 3 — GET /api/admin/policies, POST /api/admin/policies.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listPolicies, insertPolicy } from "@/modules/policy/repositories/policies.repository";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership?.org_id) return NextResponse.json({ error: "No org" }, { status: 403 });

  const orgId = (membership as { org_id: string }).org_id;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const scope = searchParams.get("scope") ?? undefined;

  const { data, error } = await listPolicies(supabase, orgId, { status, scope });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ policies: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership?.org_id) return NextResponse.json({ error: "No org" }, { status: 403 });

  const orgId = (membership as { org_id: string }).org_id;

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
