/**
 * Phase 8 — PUT /api/admin/autonomy/playbooks/:playbookKey/config.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPlaybookDefinitionByKey, upsertOrgPlaybookConfig } from "@/modules/autonomy/persistence/playbooks.repository";

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ playbookKey: string }> }
) {
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

  const { playbookKey } = await context.params;
  const { data: playbook } = await getPlaybookDefinitionByKey(supabase, playbookKey);
  if (!playbook) return NextResponse.json({ error: "Playbook not found" }, { status: 404 });

  let body: { enabled?: boolean; autonomy_mode_override?: string | null; rollout_state?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { error } = await upsertOrgPlaybookConfig(supabase, membership.org_id, playbook.id, {
    enabled: body.enabled,
    autonomy_mode_override: body.autonomy_mode_override,
    rollout_state: body.rollout_state,
  });

  if (error) return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
