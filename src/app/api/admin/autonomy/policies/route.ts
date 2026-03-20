/**
 * Phase 8 — GET/POST /api/admin/autonomy/policies.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") ?? undefined;

  const { listActivePolicies } = await import("@/modules/autonomy/persistence/policies.repository");
  const { data: policies, error } = await listActivePolicies(supabase, membership.org_id, scope);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ policies: policies ?? [] });
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

  let body: {
    policy_key: string;
    display_name: string;
    description: string;
    policy_scope: string;
    autonomy_mode: string;
    policy_rules_json: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("policies")
    .insert({
      org_id: membership.org_id,
      policy_key: body.policy_key,
      display_name: body.display_name,
      description: body.description,
      policy_scope: body.policy_scope,
      autonomy_mode: body.autonomy_mode,
      policy_rules_json: body.policy_rules_json ?? {},
      created_by_user_id: userRes.user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ policy: data });
}
